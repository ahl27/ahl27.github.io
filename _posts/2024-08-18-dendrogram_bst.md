---
title: "Converting vectors to dendrograms in R"
date: 2024-08-18
permalink: /posts/2024/08/dend-bst/
tags:
  - blog posts
  - R
---

I do really like R's `dendrogram` object, but it can be really clunky to work with them. I recently implemented [random forests from scratch](https://www.ahl27.com/posts/2024/01/randomforest/), and the decision trees within were stored as two vectors. However, it would be really nice to be able to plot these decision trees to visualize their contents. This got me thinking--is it possible to convert vectors of values into `dendrogram` objects in R if we know the vectors are ordered in a known tree traversal? In other languages this would be fairly simple, but the nested list structure of `dendrogram` objects (and their other attributes) makes it a little trickier in R.

## Setup

Let me explain the problem a little more clearly. Our input is minimally an integer vector, with an optional second vector. The integer vector encodes nodes--positive values indicate internal nodes, whereas negative values indicate leaves. The second vector is paired with data we want to include at each node; this could be thresholds for a decision tree node, labels to print, or whatever. I'm assuming the input is ordered along a breadth-first traversal. Let's see what that would look like for a small tree:

```
       a
     /   \
    b     c
   / \
  d   e

 labels: a  b  c  d  e
indices: 1  1 -1 -1 -1
```

I'm also assuming that this tree is fully bifurcating, with no interior nodes having outdegree 1. In other words, all interior nodes have exactly two children. The output we're expecting is a `dendrogram` object with the same structure as the tree implied by the `labels`/`indices` vectors.

## What makes a dendrogram?

`dendrogram` objects are nested lists with a set of attributes. Each internal node of the dendrogram has the following attributes:

- `members`: number of leaves below this node (1 for leaves)
- `height`: height of the node
- `midpoint`: (optional) x offset relative to the leftmost child for plotting

Leaf nodes have a `members` attribute of 1, usually a `height` attribute of 0, and no `midpoint` attribute. They also have the following extra attributes:

- `label`: label of the leaf
- `leaf`: logical always set to `TRUE`

One important note is that these are largely nested list objects with a bunch of attributes. What happens at the leaves? Are they just empty lists?

The answer is no. In fact, if you call `unlist` on a `dendrogram`, you'll get back a vector of integers. The leaf nodes are single integer values with additional attributes. In the previous example, the dendrogram object internally (without all its attributes) would be equivalent to:

```r
list(list(1L, 2L), 3L)
```

**This is important**. Lots of stuff breaks if you build a dendrogram object by hand that doesn't have integers in the leaves.

`dendrogram` objects have another nice property, although it isn't specific to the `dendrogram` class. Sublists in any nested list structure can be accessed using either multiple `[[` calls, or vectors of indices. For example:

```r
x <- list(list(list(1,2), list(3,4)), list(list(5,6), list(7,8)))

x[[1]][[2]][[1]]
# 3

x[[c(1,2,1)]]
# 3
```

This latter accession mode is going to be extremely useful.

## Building the nested list structure

Breadth-first searches are typically done using queues--for each node, we process it, then add its children to the end of the queue. This is what makes this operation difficult in R...we can't store pointers to nodes like we could do in (for example) C. *However*, we can actually build a queue accessing the nodes of the tree by using vectors of accessors. We can start with the root and a vector of accessors `list(1,2)`. At any particular node `x`, its children are `x[[1]]` and `x[[2]]`. That means that, given an accessor `i`, if we append `list(c(i,1)` and `list(c(i,2))` to our vector of accessors, we now have "pointers" to the children of the node accessed at `root[[i]]`.

```r
f <- function(node_indices, node_data){
  ## initialize the root node
  root <- vector('list', length=2L)
  attr(root, "members") <- 0L
  attr(root, "height") <- 0
  attr(root, "midpoint") <- 0
  attr(root, "otherdata") <- node_data[[1]]
  class(root) <- "dendrogram"

  ## set up a queue
  cur_q <- list(1,2)
  ctr <- 2L
  leafctr <- 1L
  while(ctr <= length(node_indices)){
    accessor <- cur_q[[ctr]]
    is_leaf <- node_indices[ctr] > 0
    otherdata <- node_data[[ctr]]
    if(!is_leaf){
      ## interior nodes are lists
      cur_node <- vector('list', length=2L)
      attr(cur_node, 'midpoint') <- 0

      ## add children to the queue
      cur_q <- c(cur_q, list(c(accessor, 1L), c(accessor, 2L)))
    } else {
      ## leaves are integers
      cur_node <- leafctr

      ## extra leaf attributes
      attr(cur_node, 'leaf') <- TRUE
      attr(cur_node, 'label') <- as.character(leafctr)

      leafctr <- leafctr + 1L
    }

    ## add attributes for all nodes
    attr(cur_node, 'height') <- 0
    attr(cur_node, 'members') <- 0L
    attr(cur_node, 'otherdata') <- otherdata
    class(cur_node) <- 'dendrogram'

    ## assign as a child of the current node
    root[[accessor]] <- cur_node
    ctr <- ctr + 1L
  }

  ## What are we missing here?

  root
}
```

## Fixing the nodes

This is pretty close! There's one small issue that you may have noticed in the prior function--all the attributes are wrong! We set `members` and `height` (and `midpoint`) to zero for every node, which isn't really correct. If we try to plot the resulting object, it'll be garbage.

The reason these are set to zero is because there isn't a great way to determine what the correct values of these should be during the initial processing. It's much easier to build the `dendrogram` object and then correct the values later. For this, I'm going to use [my version of `dendrapply`](https://www.ahl27.com/posts/2023/02/dendrapply/) (available in SynExtend) because it supports post-order traversals, which are important for this.

For each node `x`, we have to correct `members`, `height`, and `midpoint`. The `members` attribute is the number of leaves, which we can get with `length(unlist(x))`. The `height` attribute is relatively arbitrary, but each node has to be higher than its children for plotting. We'll just set leaves to zero, and then interior nodes to `max(height(x[[1]]), height(x[[2]])) + 1L`.

The last attribute is `midpoint`, which can be relatively complicated. This attribute determines where the node is placed on the x-axis relative to its leftmost child. I'm not entirely sure why `dendrogram` objects plot using this parameter, but the relative referencing makes things complex. Each leaf is plotted with distance 1.0 from subsequent nodes. Thus, if the children of `x` are both leaves, the midpoint is 0.5--halfway between the leaves, since the leaves are distance 1.0 apart. The other cases are more complicated, but I'll include the code below and leave the reasoning as an exercise for the reader.

```r
f <- function(node_indices, node_data){
  ## ... everything from before

  ## here's what we were missing:
  midpoint <- \(x) attr(x, 'midpoint')
  height <- \(x) attr(x, 'height')
  root <- dendrapply(root, \(x){
    if(!is.leaf(x)){
      ## internal nodes
      attr(x, 'members') <- length(unlist(x))
      attr(x, 'height') <- max(height(x[[1]]), height(x[[2]])) + 1L

      ## midpoint calculation
      mp <- 0
      child_is_leaf <- c(is.leaf(x[[1]]), is.leaf(x[[2]]))
      if(child_is_leaf[1] && child_is_leaf[2]){
        ## both children leaves
        mp <- 0.5
      } else if(child_is_leaf[1]){
        ## only left child a leaf
        mp <- ((midpoint(x[[2]]) + 1L) / 2)
      } else if(child_is_leaf[2]){
        ## only right child is a leaf
        mp <- ((midpoint(x[[1]]) + 1L) / 2) + midpoint(x[[1]])
      } else {
        ## both children non-leaves
        mp <- (attr(x[[1]], 'members') + midpoint(x[[1]]) + midpoint(x[[2]])) / 2
      }
      attr(x, 'midpoint') <- mp
    } else {
      ## leaves
      attr(x, 'members') <- 1L
    }

    x
  }, how='post.order')

  root
}
```

## Conclusion

This doesn't put together the entire function--if you're interested in the complete thing, you can check out the source code [on GitHub](https://github.com/ahl27/machineRy/blob/e5c1c0948f9e4d8a604a493dd222c3a7e905f49b/R/randomforest.R#L240). Thanks for reading!