---
title: "Refactoring R's `dendrapply`"
date: 2023-02-23
permalink: /posts/2023/02/dendrapply/
tags:
  - blog posts
  - R
  - C
---

Dendrapply
-------

As someone who specializes comparative phylogenomics, I work a lot with phylogenetic trees. Trees are represented in R as `dendrogram` objects, which are essentially a series of nested lists. Each "node" of the tree is a list with multiple members (two if a binary tree, but `dendrogram` objects are not constrained to be binary), each of which is another `dendrogram` object. The leaves are special cases in that they have length 1 and an additional property `leaf`, which is set to `TRUE`.

R has a number of functions called `apply` functions, whose primary purpose is to apply a function to a set of things in a particular way. Commonly used examples are `lapply` to apply a function over a list-like object, `tapply` to apply a function to a set of objects grouped based on a factor, `rapply` to recursively apply a function to an object, or `apply` to apply a function to a matrix/array. 

`dendrapply` is a special type of `apply` statement intended specifically for applying functions to `dendrogram` objects. The main requirement is to recursively apply a function to each node of the tree. While this may sound like a task for `rapply`, `rapply` is more intended to apply a function to non-list elements of a nested list, while `dendrapply` is intended to apply the function to all nodes in the list.

`dendrapply` is currently implemented recursively, which has led to some users experiencing issues from stack overflows resulting from deep recursion on trees with many nodes (at least in users' reports on `DECIPHER`). Additionally, the recursive implementation makes the function slow for trees with many internal nodes. `rapply` avoids this issue by factoring out the recursion internally, which gave me the idea to try to implement an optimized version of `dendrapply`.

Implementation
--------

My focus for this implementation was removing the recursive calls in `dendrapply`. The final implementation is only a modest runtime improvement, but this can hopefully be optimized prior to the final release.

The full implementation is written in C, which makes a lot of things easier at the cost of a few things becoming really hard. The algorithm proceeds as follows:

```
copytree = copy(input_dend)

initialize LinkedList
add root node to LinkedList

ptr = head(LinkedList)
while ptr is not NULL:
  if node has children:
    for child in ptr.node.children:
      insert child in next position
  else:
    apply function to node
    merge node into parent
    if first time seeing parent:
      apply function to parent

  ptr = ptr.next

return head(LinkedList).node
```

It's a little hard to write out, so I'll use a small example to showcase. Imagine we have a dendrogram with two leaves, and we want to apply a function `f` to each node `a,b,c`.

```
Tree:

    a
   / \
  b   c

Initialize LL:

HEAD -> NULL


Add root node:

HEAD -> a -> NULL


Set ptr to head:

HEAD -> a* -> NULL


Iterate over linked list:

HEAD -> a* -> c -> NULL             (insert child, back to front to ensure correct traversal)
HEAD -> a* -> b -> c -> NULL        (insert child)
HEAD -> a -> b* -> c -> NULL        (increment pointer)
HEAD -> a -> B* -> c -> NULL        (b has no children; apply f, f(b)=B)
HEAD -> aB* -> c -> NULL            (merge B into parent)
HEAD -> AB* -> c -> NULL            (apply f to parent, f(a) = A)
HEAD -> AB -> c* -> NULL            (increment pointer)
HEAD -> AB -> C* -> NULL            (c has no children; apply f to c, f(c) = C)
HEAD -> ABC* -> NULL                (merge C into parent)
```

This implementation achieves the same result as a recursive operation, but doesn't run the risk of overflowing the stack for deep trees. 

Details and Difficulties
------------

There are a few things about the implementation of this that make things difficult. First, the R garbage collector likes to collect R objects while they're being worked on in C. We can get around this by using `PROTECT()` to tell the garbage collector not to touch the object, but the protection stack has a fixed size that is extremely small (10,000 items by default). The tree as a whole can be protected when it's first loaded, but anytime we call `f()` on a node of the tree, we have to protect the result. 

The naive approach is to just put all the nodes into a linked list, apply the function to every node, then rebuild the tree. Unfortunately, this rapidly exhausts the available space we have on the protection stack. Instead, we have to work slightly smarter. 

It turns out that the order in which we apply the function to the nodes changes what the optimal implementation is.

The most efficient implementation uses a post-order traversal, which can apply `f` to all nodes using three slots on the protection stack. This is the schema outlined in the previous example. The initial tree is protected, which automatically protects all child nodes. Then, we create the linked list as shown and traverse the tree structure in post-order fashion. We call `PROTECT` on the output of the function applied to each node, but then the value is immediately assigned to the parent using `SET_VECTOR_ELT`, which is already protected and thus protects the child by default. This requires one protection for the overall tree, one for the R function call, and one for the transient result of the function applied to a node. This implementation also has the nice property that all children of a particular node are computed prior to applying the function to the given node, meaning that the following functions become possible:

```{r}
exFunc <- function(x){
  attr(x, 'newA') <- 'a'
  if(is.null(attr(x, 'leaf'))){
    cat(attr(x[[1]], 'newA'), attr(x[[2]], 'newA'))
    cat('\n')
  }
  x
})
```
This function assigns a new attribute to the current node, then prints the childrens' value for that new attribute. This finds values using the new implementation, but not the old:
```{r}
library(dendextend)

# dendrogram with 3 leaves and two internal nodes
dend <- 1:3 %>%
          dist() %>%
          hclust() %>%
          as.dendrogram() 

stats::dendrapply(dend, exFunc)
# Prints nothing

new_dendrapply(dend, exFunc)
# Prints:
# a a
# a a
```
This capability is something I have found myself wishing for often in `dendrapply`. 

The caveat of this approach is that it differs from the current implementation of `dendrapply`. `stats::dendrapply` is currently implemented using an inorder traversal of nodes, which packages like `dendextend` rely upon for their expected output. As a result, using a postorder-based `dendrapply` will likely break packages currently using dendrapply. This could be resolved by adding in an additional option or alias to distinguish the old from the new dendrapply, or by implementing an inorder based `dendrapply`. It may be worthwhile to implement a `how=c("in.order", "post.order", "pre.order")` option, with the default method `"in.order"`. This would be relatively trivial with the implementations I have, and would not break old packages.

The inorder traversal can also be implemented with constant protection stack size, although the implementation is a little clunky. Each transient node result is assigned to the parent using `SET_VECTOR_ELT`, then the result is populated into the current value. Subtree merging will re-assign values up to the parents since we cannot guarantee that the children of a given node are identical when we make the first merge. However, this approach is able to preserve constant stack space. 

A preorder traversal is definitely possible, but I haven't dedicated any time to figuring out how to implement it. Breadth-first traversals are also easily implementable by making elements insert at the end of the linked list rather than at the next position.


Benchmarking
-------

Speed gains from this implementation are relatively modest, although I suspect that further optimization could improve runtime. As the main improvement of this is in the backend and not the function call itself, it should have relatively consistent performance regardless of the input function. Testing was performed on a simple function to add an attribute to each node, as well as a recursive one that calls `rapply` at every node. Speedup is consistent regardless of function, with the average boost in runtime approximately 2x on my machine (2021 MacBook Pro, M1 Pro, 32GB RAM). Looking at the memory usage of the functions, my new implementation has significantly decreased usage due to fewer function call frames allocated on the stack.

![](/images/blog_images/dendrapply_benchmark1.png)

Compatibility with the previous version of `dendrapply` was tested against the unit tests available in `dendextend`, one of the largest packages that makes extensive usage of `stats::dendrapply` in a variety of scenarios. The inorder traversal version passed all unit tests.


![](/images/blog_images/dendrapply_unittest.png)



Complete Code:
---------

### R Script

This has some quirks to make it a drop-in replacement for `stats::dendrapply`. The behavior of the original function when the provided function does not return a `dendrogram` or `list`-like object is a little counterintuitive to me, but after lots of testing this implementation should replicate it all accurately.

```{r}
dendrapply <- function(X, FUN, ...){
  ## Free allocated memory in case of early termination
  on.exit(.C("free_dendrapply_list"))
  stopifnot(is(X, 'dendrogram'))
  wrapper <- \(node) {
    # I'm not sure why VECTOR_ELT unclasses the object
    # nodes coming in should always be dendrograms
    class(node) <- 'dendrogram'
    res<-FUN(node, ...)
    if(length(node)!=1){
      if(!(inherits(res,c('dendrogram', 'list')))){
        #res <- lapply(seq_along(node), list)
        res <- lapply(unclass(node), \(x) x)
      } 
    }
    res
  }
  # If we only have one node, it'll hang
  # We can get around this by just applying the function to the leaf
  # and returning--no need for C code here.
  if(!is.null(attr(X, 'leaf')) && attr(X,'leaf')){
    return(wrapper(X))
  }
  return(.Call("do_dendrapply", X, wrapper, parent.frame()))
}
```

### Inorder traversal

{% highlight c %}
#include <R.h>
#include <Rdefines.h>

/*
 * Linked list struct
 *
 * Each node of the tree is added with the following args:
 *  -   node: tree node, as a pointer to SEXPREC object
 *  -      v: location in parent node's list
 *  - isLeaf: Counter encoding unmerged children. 0 if leaf or leaf-like subtree.
 *  - parent: pointer to node holding the parent node in the tree
 *  -   next: next linked list element
 * 
 */
typedef struct ll_S {
  SEXP node;
  int v;
  int isLeaf;
  struct ll_S *parent;
  struct ll_S *next;
  PROTECT_INDEX protptr;
  char isProtected;
} ll_S;


/* Global variable for on.exit() free */
ll_S *ll;

/* 
 * Frees the global linked list structure.
 *
 * Called using on.exit() in R for cases where
 * execution is stopped early.
 */
void free_dendrapply_list(){
  ll_S *ptr = ll;
  while(ll){
    ll = ll->next;
    free(ptr);
    ptr=ll;
  }

  return;
}

/* Function to allocate a LL node */
ll_S* alloc_link(ll_S* parentlink, SEXP node, int i){
  ll_S *link = malloc(sizeof(ll_S));

  /* lazy evaluation of the nodes to conserve PROTECT calls */
  link->node = NULL;
  link->next = NULL;
  link->v = i;
  link->parent = parentlink;
  link->isLeaf = -1;
  link->isProtected = 0;
  
  return link;
}


/*
 * Main workhorse function.
 * 
 * This function traverses the tree INORDER (as in stats::dendrapply)
 * and applies the function to each node, then adds its children to
 * the linked list. Once all the children of a node have been processed,
 * the child subtrees are combined into the parent. R ensures that the
 * dendrogram isn't a leaf, so this function assmes the dendrogram has 
 * at least two members.
 */
SEXP new_apply_dend_func(ll_S *head, SEXP f, SEXP env){
  ll_S *ptr, *prev, *parent;
  SEXP node, call, newnode;
  PROTECT_INDEX callptr;

  /* Reserve space in the protect stack and process root */
  PROTECT_WITH_INDEX(call = LCONS(f, LCONS(head->node, R_NilValue)), &callptr);
  REPROTECT(head->node = R_forceAndCall(call, 1, env), head->protptr);

  int n;
  ptr = head;
  prev = head;
  while(ptr){
    R_CheckUserInterrupt();
    /* lazily populate node, apply function to it as well */
    if (!(ptr->isProtected)){
      parent = ptr->parent;
      newnode = VECTOR_ELT(parent->node, ptr->v);
      ptr->isLeaf = isNull(getAttrib(newnode, install("leaf"))) ? length(newnode) : 0;
      REPROTECT(call = LCONS(f, LCONS(newnode, R_NilValue)), callptr);
      newnode = PROTECT(R_forceAndCall(call, 1, env));
      SET_VECTOR_ELT(parent->node, ptr->v, newnode);
      UNPROTECT(1);

      /* double ELT because it avoids a protect */
      ptr->node = VECTOR_ELT(parent->node, ptr->v);
      ptr->isProtected = 1;
    }

    if (ptr->isProtected == 2){
      /* these are nodes flagged for deletion */
      prev->next = prev->next->next;
      free(ptr);
      ptr = prev->next;

    } else if(ptr->isLeaf == 0){
      /* 
      * If the LL node is a leaf or completely merged subtree,
      * apply the function to it and then merge it upwards
      */
      while(ptr->isLeaf == 0 && ptr != head){
        /* merge upwards, 
         * protection unneeded since parent already protected 
         */
        prev = ptr->parent;
        SET_VECTOR_ELT(prev->node, ptr->v, ptr->node);
        UNPROTECT(1);
        prev->isLeaf -= 1;

        /* flag node for deletion later */
        ptr->isProtected = 2;
        ptr = prev;
        prev = ptr;
        R_CheckUserInterrupt();
      }

      /* go to the next element so we don't re-add */
      ptr = ptr->next;

    } else {
      /* ptr->isLeaf != 0, so we need to add nodes */
      node = ptr->node;
      n = length(node);

      if(isNull(getAttrib(node, install("leaf")))){
        ll_S *newlink;
        /*
         * iterating from end to beginning to ensure 
         * we traverse depth-first instead of breadth
         */
        for(int i=n-1; i>=0; i--){
          newlink = alloc_link(ptr, node, i);
          newlink->next = ptr->next;
          ptr->next = newlink;
        }
      }
      prev = ptr;
      ptr = ptr->next; 
    }
  }

  /* Unprotect the SEXP for the function call */
  UNPROTECT(1);
  return head->node;
}

/*
 * Main Function
 * 
 * Calls helper functions to build linked list,
 * apply function to all nodes, and reconstruct
 * the dendrogram object. Attempts to free the linked list 
 * at termination, but note memory free not guaranteed to 
 * execute here due to R interrupts. on.exit() used in R to 
 * account for this.
 */
SEXP do_dendrapply(SEXP tree, SEXP fn, SEXP env){
  PROTECT_INDEX headprot;
  SEXP treecopy;
  PROTECT_WITH_INDEX(treecopy = duplicate(tree), &headprot);

  /* Add the top of the tree into the list */
  ll = malloc(sizeof(ll_S));
  ll->node = treecopy;
  ll->next = NULL;
  ll->parent = NULL;
  ll->isLeaf = length(treecopy);
  ll->v = -1;
  ll->isProtected = 1;
  ll->protptr = headprot;

  /* Build the list */
  //build_list(ll);

  /* Apply the function to the list */
  treecopy = new_apply_dend_func(ll, fn, env);
  
  /* Attempt to free the linked list and unprotect */

  free_dendrapply_list();
  UNPROTECT(1);
  return treecopy;
}
{% endhighlight %}

### Postorder Traversal

This code is very similar to the inorder traversal--if both are to be implemented, I'd probably refactor these a lot into a more concise set of code. I haven't gotten around to it yet, but since there's only a handful of different lines between the two files it should be fairly straightforward.

{% highlight c %}
#include <R.h>
#include <Rdefines.h>

/*
 * Linked list struct
 *
 * Each node of the tree is added with the following args:
 *  -   node: tree node, as a pointer to SEXPREC object
 *  -      v: location in parent node's list
 *  - isLeaf: Counter encoding unmerged children. 0 if leaf or leaf-like subtree.
 *  - parent: pointer to node holding the parent node in the tree
 *  -   next: next linked list element
 * 
 */
typedef struct ll_S {
  SEXP node;
  int v;
  int isLeaf;
  struct ll_S *parent;
  struct ll_S *next;
  PROTECT_INDEX protptr;
  char isProtected;
} ll_S;


/* Global variable for on.exit() free */
ll_S *ll;

/* 
 * Frees the global linked list structure.
 *
 * Called using on.exit() in R for cases where
 * execution is stopped early.
 */
void free_dendrapply_list(){
  ll_S *ptr = ll;
  while(ll){
    ll = ll->next;
    free(ptr);
    ptr=ll;
  }

  return;
}

/* Function to allocate a LL node */
ll_S* alloc_link(ll_S* parentlink, SEXP node, int i){
  ll_S *link = malloc(sizeof(ll_S));
  SEXP curnode;
  link->next = NULL;
  link->v = i;
  link->parent = parentlink;
  link->isProtected = 0;
  curnode = VECTOR_ELT(node, i);
  link->node = curnode;
  link->isLeaf = isNull(getAttrib(curnode, install("leaf"))) ? length(curnode) : 0;

  return link;
}


/*
 * Main workhorse function.
 * 
 * This function traverses the tree INORDER (as in stats::dendrapply)
 * and applies the function to each node, then adds its children to
 * the linked list. Once all the children of a node have been processed,
 * the child subtrees are combined into the parent. R ensures that the
 * dendrogram isn't a leaf, so this function assmes the dendrogram has 
 * at least two members.
 */
SEXP new_apply_dend_func(ll_S *head, SEXP f, SEXP env){
  ll_S *ptr, *prev;
  SEXP node, call, newnode;
  PROTECT_INDEX callptr;

  /* Reserve space in the protect stack and process root */
  PROTECT_WITH_INDEX(call = LCONS(f, LCONS(head->node, R_NilValue)), &callptr);

  int n;
  ptr = head;
  prev = head;
  while(ptr){
    R_CheckUserInterrupt();

    if (ptr->isProtected == 2){
      /* these are nodes flagged for deletion */
      prev->next = prev->next->next;
      free(ptr);
      ptr = prev->next;

    } else if(ptr->isLeaf == 0){
      /* 
      * If the LL node is a leaf or completely merged subtree,
      * apply the function to it and then merge it upwards
      */
      while(ptr->isLeaf == 0 && ptr != head){
        /* merge upwards, 
         * protection unneeded since parent already protected 
         */

        REPROTECT(call = LCONS(f, LCONS(ptr->node, R_NilValue)), callptr);
        PROTECT(newnode = R_forceAndCall(call, 1, env));

        prev = ptr->parent;
        SET_VECTOR_ELT(prev->node, ptr->v, newnode);
        UNPROTECT(1);

        prev->isLeaf -= 1;

        /* flag node for deletion later */
        ptr->isProtected = 2;
        ptr = prev;
        prev = ptr;
        R_CheckUserInterrupt();
      }

      /* go to the next element so we don't re-add */
      ptr = ptr->next;

    } else {
      /* ptr->isLeaf != 0, so we need to add nodes */
      node = ptr->node;
      n = length(node);

      if(isNull(getAttrib(node, install("leaf")))){
        ll_S *newlink;
        /*
         * iterating from end to beginning to ensure 
         * we traverse depth-first instead of breadth
         */
        for(int i=n-1; i>=0; i--){
          newlink = alloc_link(ptr, node, i);
          newlink->next = ptr->next;
          ptr->next = newlink;
        }
      }
      prev = ptr;
      ptr = ptr->next; 
    }
  }

  REPROTECT(call = LCONS(f, LCONS(head->node, R_NilValue)), callptr);
  REPROTECT(head->node = R_forceAndCall(call, 1, env), head->protptr);

  /* Unprotect the SEXP for the function call */
  UNPROTECT(1);
  return head->node;
}

/*
 * Main Function
 * 
 * Calls helper functions to build linked list,
 * apply function to all nodes, and reconstruct
 * the dendrogram object. Attempts to free the linked list 
 * at termination, but note memory free not guaranteed to 
 * execute here due to R interrupts. on.exit() used in R to 
 * account for this.
 */
SEXP do_dendrapply(SEXP tree, SEXP fn, SEXP env){
  PROTECT_INDEX headprot;
  SEXP treecopy;
  PROTECT_WITH_INDEX(treecopy = duplicate(tree), &headprot);

  /* Add the top of the tree into the list */
  ll = malloc(sizeof(ll_S));
  ll->node = treecopy;
  ll->next = NULL;
  ll->parent = NULL;
  ll->isLeaf = length(treecopy);
  ll->v = -1;
  ll->isProtected = 1;
  ll->protptr = headprot;

  /* Apply the function to the list */
  treecopy = new_apply_dend_func(ll, fn, env);
  
  /* Attempt to free the linked list and unprotect */

  free_dendrapply_list();
  UNPROTECT(1);
  return treecopy;
}
{% endhighlight %}
