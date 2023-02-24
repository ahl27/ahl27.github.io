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

We can get around this issue by immediately assigning the value of `f(node)` to the parent node. If the parent node is protected, the value assigned to it will be protected as well. This means that, as long as we ensure the parent is always protected, we don't need any extraneous protection calls.

I've implemented two methods for `dendrapply`: a pre-order traversal and a post-order traversal. The final implementation for both uses a maximum of 3 slots on the protection stack, and no recursive function calls. The original tree consumes the first `PROTECT` call, which protects all its children until they're modified. When each node is evaluated, we use a `PROTECT` call to create the R expression to be called and a second to protect the `SEXP` returned from the function. This value is then assigned to the parent node using `SET_VECTOR_ELT`, which protects the value. Since protection is by value and not by reference, we can safely store this new value in the linked list. 

The result is a little funky in the pre-order case: we use `VECTOR_ELT` on the parent to get the node, call the function on it, replace the node using `SET_VECTOR_ELT` on the parent, and then populate the reference in the linked list by calling `VECTOR_ELT` on the parent a second time. This ensures we always have protected values.

With a post-order traversal, the implementation is a little cleaner. Since the children of each node are always evaluated prior to the node itself, we don't need to recall `VECTOR_ELT` after calling the function. Instead, we can just merge the nodes and continue.

The main difference for end users between the two traversals is that, for a given node `n`, pre-order traversal will always evaluate `f(n)` *before any of its children*, whereas post-order traversal will always evaluate `f(n)` *after all of its children*. Pre-order is the default for consistency with `stats::dendrapply`, which used a pre-order traversal. The post-order method allows for some new functions, such as the following:

{% highlight R %}
f <- function(x){
  if(!is.null(attr(x, 'leaf'))){
    v <- as.character(attr(x, 'label'))
  } else {
    v <- paste0(attr(x[[1]], 'newattr'), attr(x[[2]], 'newattr'))
  }
  attr(x, 'newattr') <- v
  x
}
{% endhighlight %}

This function assigns a new attribute equal to the label if it's a leaf, or the concatenation of the child nodes' new attributes. The default application of `dendrapply` will only create new attributes for the leaves, and will return `character(0)` for any internal nodes. However, using `how='post.order'` will ensure we evaluate the children first, meaning that internal nodes will be assigned a non-empty value:

{% highlight R %}
# dendrogram with 3 leaves and two internal nodes
dend <- as.dendrogram(hclust(dist(1:3)))

# Base stats application
stats::dendrapply(dend, exFunc)
attr(dend, 'newattr')
# > character(0)

# pre-order (default)
dendrapply(dend, exFunc, how='pre.order')
attr(dend, 'newattr')
# > character(0)

# post-order
new_dendrapply(dend, exFunc, how='post.order')
attr(dend, 'newattr')
# > "312"
{% endhighlight %}
This capability is something I have found myself wishing for often in `dendrapply`. 


Tentative Future Additions
--------

A inorder traversal is definitely possible, but I haven't dedicated any time to figuring out how to implement it. I'm not sure if these are worth making; I can't think of a great use-case for applying functions according to an in-order traversal. The implementation would use the almost same code as the post-order case, although nodes would be added by inserting the right element next and the left element at the end of the list. I'm not sure if inorder traversals are defined for multifurcating trees, which is another complicating factor.

Breadth-first traversals are also easily implementable by making elements insert at the end of the linked list rather than at the next position. However, the behavior of these can be a little odd with `dendrogram` objects (the result is fairly counterintuitive to me at least). These may be worth exploring as options in the future.

Something I would like to implement is a "flat" application of `dendrapply`, similar to the flexibility offered in `rapply`. Providing an option to get the results as a flat list/vector could have very good usecases. To illustrate what this would look like, imagine the following tree with shown labels:

```
     a
   /   \
  b     c
 / \   / \
e   f g   h
```
I'd like the function to be able to do something like:

```
> dendrapply(exTree, \(x) attr(x, 'label'), how='post.order', flatten=TRUE)
[1] "e" "f" "b" "g" "h" "c" "a"

> dendrapply(exTree, \(x) attr(x, 'label'), how='pre.order', flatten=TRUE)
[1] "a" "b" "e" "f" "c" "g" "h"
```

Note that this is different from `dendrapply` in that the result is a flat vector and not a nested list, and different from `rapply` in that the result is the function applied to leaves *and* internal nodes.

Benchmarking
-------

Speed gains from this implementation are relatively modest, although I suspect that further optimization could improve runtime. As the main improvement of this is in the backend and not the function call itself, it should have relatively consistent performance regardless of the input function. Testing was performed on a simple function to add an attribute to each node, as well as a recursive one that calls `rapply` at every node. Speedup is consistent regardless of function, with the average boost in runtime approximately 1.5-3x on my machine (2021 MacBook Pro, M1 Pro, 32GB RAM). Looking at the memory usage of the functions, my new implementation has significantly decreased usage due to fewer function call frames allocated on the stack.

![](/images/blog_images/dendrapply_benchmark1.png)

Compatibility with the previous version of `dendrapply` was tested against the unit tests available in `dendextend`, one of the largest packages that makes extensive usage of `stats::dendrapply` in a variety of scenarios. The inorder traversal version passed all unit tests.


![](/images/blog_images/dendrapply_unittest.png)



Complete Code:
---------

### R Script

This has some quirks to make it a drop-in replacement for `stats::dendrapply`. The behavior of the original function when the provided function does not return a `dendrogram` or `list`-like object is a little counterintuitive to me, but after lots of testing this implementation should replicate it all accurately.

{% highlight R %}
dendrapply <- function(X, FUN, ..., how=c("pre.order", "post.order")){
  apply_method <- match.arg(how)
  travtype <- switch(apply_method,
                     pre.order=0L,
                     post.order=1L)
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
  return(.Call("do_dendrapply", X, wrapper, parent.frame(), travtype))
}
{% endhighlight %}

### C Code

{% highlight c %}
#include <R.h>
#include <Rdefines.h>

/*
 * Author: Aidan Lakshman
 * Contact: AHL27@pitt.edu
 *
 * This is a set of C functions that apply an R function to all internal
 * nodes of a dendrogram object. This implementation runs roughly 2x
 * faster than base `stats::dendrapply`, and deals with dendrograms
 * with high numbers of internal branches. Notably, this implementation
 * unrolls the recursion to prevent any possible stack overflow errors. 
 *
 */

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
} ll_S;


/* Global variable for on.exit() free */
ll_S *ll;
PROTECT_INDEX headprot;

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
ll_S* alloc_link(ll_S* parentlink, SEXP node, int i, short travtype){
  ll_S *link = malloc(sizeof(ll_S));

  if(travtype == 0){
    link->node = NULL;
    link->isLeaf = -1;
  } else if (travtype == 1){
    SEXP curnode;
    curnode = VECTOR_ELT(node, i);
    link->node = curnode;
    link->isLeaf = isNull(getAttrib(curnode, install("leaf"))) ? length(curnode) : 0;
  }

  link->next = NULL;
  link->v = i;
  link->parent = parentlink;

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
SEXP new_apply_dend_func(ll_S *head, SEXP f, SEXP env, short travtype){
  ll_S *ptr, *prev, *parent;
  SEXP node, call, newnode;

  if(travtype == 0){
    call = PROTECT(LCONS(f, LCONS(head->node, R_NilValue)));
    REPROTECT(head->node = R_forceAndCall(call, 1, env), headprot);
    UNPROTECT(1);
  }

  int n;
  ptr = head;
  prev = head;
  while(ptr){
    R_CheckUserInterrupt();
    /* lazily populate node, apply function to it as well */
    if (travtype==0 && ptr->isLeaf==-1){
      parent = ptr->parent;
      newnode = VECTOR_ELT(parent->node, ptr->v);
      ptr->isLeaf = isNull(getAttrib(newnode, install("leaf"))) ? length(newnode) : 0;
      call = PROTECT(LCONS(f, LCONS(newnode, R_NilValue)));
      newnode = PROTECT(R_forceAndCall(call, 1, env));
      SET_VECTOR_ELT(parent->node, ptr->v, newnode);
      UNPROTECT(2);

      /* double ELT because it avoids a protect */
      ptr->node = VECTOR_ELT(parent->node, ptr->v);
    }

    if (ptr->isLeaf == -2){
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
        /* 
         * merge upwards, 
         * protection unneeded since parent already protected 
         */
        prev = ptr->parent;
        if(travtype == 0){
          SET_VECTOR_ELT(prev->node, ptr->v, ptr->node);
        } else if(travtype == 1){
          call = PROTECT(LCONS(f, LCONS(ptr->node, R_NilValue)));
          newnode = PROTECT(R_forceAndCall(call, 1, env));

          prev = ptr->parent;
          SET_VECTOR_ELT(prev->node, ptr->v, newnode);
          UNPROTECT(2);
        }

        prev->isLeaf -= 1;

        /* flag node for deletion later */
        ptr->isLeaf = -2;
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
          newlink = alloc_link(ptr, node, i, travtype);
          newlink->next = ptr->next;
          ptr->next = newlink;
        }
      }
      prev = ptr;
      ptr = ptr->next; 
    }
  }

  if (travtype == 1){
    call = PROTECT(LCONS(f, LCONS(head->node, R_NilValue)));
    REPROTECT(head->node = R_forceAndCall(call, 1, env), headprot);
    UNPROTECT(1);
  }
  
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
SEXP do_dendrapply(SEXP tree, SEXP fn, SEXP env, SEXP order){
  /* 0 for preorder, 1 for postorder */
  short travtype = INTEGER(order)[0];
  SEXP treecopy;
  PROTECT_WITH_INDEX(treecopy = duplicate(tree), &headprot);

  /* Add the top of the tree into the list */
  ll = malloc(sizeof(ll_S));
  ll->node = treecopy;
  ll->next = NULL;
  ll->parent = NULL;
  ll->isLeaf = length(treecopy);
  ll->v = -1;

  /* Apply the function to the list */
  treecopy = new_apply_dend_func(ll, fn, env, travtype);
  
  /* Attempt to free the linked list and unprotect */

  free_dendrapply_list();
  UNPROTECT(1);
  return treecopy;
}
{% endhighlight %}
