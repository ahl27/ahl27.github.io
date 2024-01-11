---
title: "Writing a Random Forest from Scratch"
date: 2024-01-11
permalink: /posts/2024/01/randomforest/
tags:
  - blog posts
  - R
  - C
  - Fortran
---

I've recently had to implement random forests from scratch in R. This is a much longer post than I normally make,
since I'm going to go through all the details of actually implementing one of these models. By "from scratch", I
mean a complete Random Forest prediction model, written in R, with no packages aside from those provided in
a base installation.

There are a bunch of steps involved, but before that, I'm going to address the most obvious question people will
ask: why? There already exists the `randomForest` package for R that does a great job at implementing Random Forests,
why reinvent the wheel? The answer is twofold.

First, my lab puts a high premium on software that doesn't have
external dependencies. My doctoral work partly depends on using random forest predictors, and we'd like to avoid
having to rely on the `randomForest` package. Controlling all your dependencies means you know the codebase better,
have full control on updating it, and you can ensure that it is fully interoperable with your own code. Obviously
that isn't always feasible, but in this case it is.

The second reason is a lot simpler: it's a great learning experience, and a great excuse to finally use the Fortran
skills I've been practicing over winter break.

**This will be a work in progress until I finish my implementation**

You can check out the current codebase at [https://github.com/ahl27/machineRy](https://github.com/ahl27/machineRy)

## Step 0: Planning

This is a big project, and I'm not looking for a half-assed solution. For things like this, the best first step is
to plan out what you're going to implement based on your priorities. I usually start by defining my priorities
and the steps involved, and figure out which languages I'm going to use for what based on those two things together.

For myself in this project, the priorities were as follows:

1. It should work, at least for classification. No crashing R sessions.
2. Runtime and accuracy should be similar to `randomForest`. Lower runtime is acceptable if accuracy is higher.
3. User experience should be the same as other models in R (e.g., call with something like `rf(response ~ ., data=data)`
4. Models should be able to be saved/loaded in R.

Now, for the steps involved. Random Forests are a relatively simple algorithm that consist of a train and test phase.
For a set of input data, we construct `n` decision trees. Each tree is constructed using bootstrapped sample of the data
(sample some amount of rows with replacement). Thus, we need to be able to do the following things:

1. Correctly recognize what the user is asking for in R (parse `formula` objects)
2. Partition input data to improve prediction accuracy (i.e., a decision tree node)
3. Do (2) a bunch of times to make a decision tree
4. Do (3) a bunch of times to make a forest
5. Save (4) in such a way that it persists in R and can be saved without taking tons of memory
6. Make predictions using (5)

Under the constraints and priorities I have, the languages to use were pretty clear. First, the whole solution has to
be R-compatible, so the only languages available to me are R, C, and Fortran. (1) will necessarily be in R, since
the user interface will be R-exposed. (3-4) are major computational components and require tree structures, so C is a
natural choice. (5) is likely going to be a combination of C and R, since R-Fortran interfaces are now generally
discouraged. (6) is also going to be an R/C combo, since there needs to be an R interface but it still relies on tree
structures (tree structures are fast and simple to implement in C but challenging in R). That just leaves (2), which is
the most numerically intensive operation. For this, I'm going to rely on Fortran, since it does a good job with numerical
calculations and is much easier for me to debug than C.

The last step is figuring out how to actually implement it. I'd like to test early and often, so ideally I develop in such
a way that I start with self-contained components that can be tested in a vacuum. I also like to start with the toughest
components to get them out of the way. I ended up on the following order of application:

1. Determine an R-compatible way to represent decision trees, and write code to read/write between R and C [C, some R]
2. Make decision tree nodes for classification [Fortran, some C]
3. Make a decision tree [C]
4. Make random forests [R, some C]
5. Figure out the `formula` syntax to train a decision tree [R]
6. Figure out the `formula` syntax to make predictions with a decision tree [R]
7. Extend to full random forests
8. Make decision tree nodes for regression [Fortran, some C]
9. Double check `randomForest` for features I may be missing
10. Optimize existing implementations

That being said, let's jump into it!

## Step 1: Internal Architecture

Determining *how* we're going to represent decision trees is an important point, because everything else
depends on it. If my structure is bad, then I'll have to refactor significant amounts of code down the line. Looking
at the priorities of the project, we want it to be a robust implementation with models that can be saved/loaded and good
optimization in terms of memory usage and runtime.

Because of this, there are a few things we **cannot** do. The naive approach is just to build trees directly in R. However,
memory allocation and garbage collection in R is slow, and R doesn't have great support for tree structures. End users don't
really need direct access to each decision tree, so it's okay if we obfuscate the internal model in something like C.

However, C presents its own challenges. While it is possible to save a pointer to a C object within R, these objects are super
finicky. These "External Pointer" objects do not copy their values, and they cannot be saved across R sessions. That means that
if your R session ever restarts (or if you try to save off the object), the external pointer will be garbage.

I settled on a mixed approach. We'll have an R object that saves a compressed version of all the data required to reconstruct a
decision tree, along with an external pointer object. Whenever we use this R object in C, we can check if the external pointer
is a real object, or if its become garbage. If it is garbage, then we just reconstruct the object in C, point the external
pointer at it and carry on.

We do still have to be careful here, since as mentioned previously, it isn't super simple to store tree structures
within R. I also want to make sure we're not saving huge objects, since we're going to have to make hundreds of these decision
trees for each random forest. If a single decision tree takes 2MB to store, a 500-tree Random Forest will be 1GB!

I ended up with the following structure. First, we have this structure in C to define a decision tree node:

```c
struct DTreeNode {
  struct DTreeNode *left;
  struct DTreeNode *right;
  double threshold;
  double gini_gain;
  int index;
};
typedef struct DTreeNode DTN;
```

Here `DTN` stands for Decision Tree Node. The basic structure is just a binary tree node, with pointers to the left and right
nodes. I also have three additional variables: `index`, which defines which column of the data we split on, `threshold`, which
determines the value of that column to split on, and `gini_gain`, which is the Gini gain of that split. When I eventually move
on to regression, `gini_gain` can also hold the residual improvement.

This implementation actually allows for a very simple compressed storage in R. Internal nodes of the decision tree will always have
a nonnegative value of `index`. We can then create leaf nodes by setting `index` to `-1`, and using `threshold` to store the
prediction for that leaf node. For classification, we just cast the result to `int`, and for regression it's already in the correct
format. Then, we can read it out to R by traversing the tree in a breadth-first search. This allows us to store the entire tree
as three vectors (one `int`, two `double`), which can be compressed in R using `rle`.

This means that, given these three vectors, we can reconstruct a decision tree by calling the following function:
```c
// basic queue structure
struct DTNqueue{
  struct DTNqueue *next;
  DTN *ptr;
};
typedef struct DTNqueue queue;

DTN *bfs_q2tree(int *indices, double *thresholds, double *gini, int length){
  // set up a queue
  queue *q = malloc(sizeof(queue));
  queue *end = q;
  queue *tmp_q = q;
  DTN *tmp, *head;

  // initialize decision tree
  head = initNode();
  q->ptr = head;
  q->next = NULL;
  int i=0, cur_ind;

  while(q && i<length){
    // load value into queue
    cur_ind = indices[i];
    tmp = q->ptr;
    tmp->threshold = thresholds[i];
    tmp->gini_gain = gini[i];
    tmp->index = cur_ind;
    if(cur_ind > -1){
      // add both children of the node into the queue
      end->next = malloc(sizeof(queue));
      end = end->next;
      tmp->left = initNode();
      end->ptr = tmp->left;
      end->next = malloc(sizeof(queue));
      end=end->next;
      tmp->right = initNode();
      end->ptr = tmp->right;
      end->next = NULL;
    }

    i++;
    q = q->next;
  }

  // free the entire queue
  while(tmp_q){
    q = tmp_q;
    tmp_q = tmp_q->next;
    free(q);
  }

  // return the tree
  return head;
}
```

Then, we just need an R interface:
```c
SEXP R_get_treeptr(SEXP VolatilePtr, SEXP INDICES, SEXP THRESHOLDS, SEXP GINIS, SEXP LEN){
  // if tree exists, just return the external pointer
  // note that it seems R_NilValue can be treated as an external pointer address for whatever reason
  if(VolatilePtr != R_NilValue && R_ExternalPtrAddr(VolatilePtr)) return(VolatilePtr);

  // otherwise, create the tree
  DTN *tree = bfs_q2tree(INTEGER(INDICES), REAL(THRESHOLDS), REAL(GINIS), INTEGER(LEN)[0]);

  int madePtr = 0;
  if(VolatilePtr == R_NilValue){
    // if the pointer is just NULL, we make a pointer for it
    VolatilePtr = PROTECT(R_MakeExternalPtr(tree, R_NilValue, R_NilValue));
    madePtr = 1;
  } else {
    // else just set the address of the pointer to the tree we just made
    R_ExternalPtrAddr(VolatilePtr) = tree;
  }
  R_RegisterCFinalizerEx(VolatilePtr, (R_CFinalizer_t) R_TreeFinalizer, TRUE);
  if(madePtr) UNPROTECT(1);
  return VolatilePtr;
}
```

It's really important to test functions frequently! This is a set of functions that can be directly tested--even
if we can't "learn" decision trees, we can provide these functions with a set of dummy values to make sure it's
working properly. All we need are three vectors in R, and some way to print them. My logic for printing out a
decision tree is...long, so I'm just going to say "trust me, it works". If you're interested in the full code,
you can look at it on the project website. Just to give a sense of what this looks like, here's one of my R
functions for testing these functions:

{% highlight R %}
test_balanced_tree <- function(tree_depth){
  tree_depth <- as.integer(tree_depth)
  indices <- sample(1L:9L, 2**tree_depth-1, replace=TRUE)
  thresholds <- trunc(runif(2**tree_depth-1, min=0, max=10)*10) / 10
  gini_gain <- runif(2**tree_depth-1)

  indices[(2**(tree_depth-1)):(length(indices))] <- -1L

  print(indices)
  print(thresholds)
  .Call("test_bfs_q2tree", indices, thresholds, gini_gain, length(indices))
}
{% endhighlight %}

`test_bfs_q2tree` is a C function that essentially looks like this:

```c
SEXP test_bfs_q2tree(SEXP INDICES, SEXP THRESHOLDS, SEXP GINI, SEXP LEN){
  // reconstruct the tree
  SEXP R_ptr = PROTECT(R_get_treeptr(R_NilValue, INDICES, THRESHOLDS, GINI, LEN));

  // get the tree from the R external pointer
  DTN *tree = (DTN *) R_ExternalPtrAddr(R_ptr);

  // print it out
  printDecisionTree(tree);

  // free its memory
  freeDecisionTree(tree);

  // unprotect the R external pointer and return
  UNPROTECT(1);
  return R_NilValue
}
```

## Conclusion

Conclusion? But we still have so much to go!

Yep. This takes me a while to write, and I'm also not completely done with the code. Code-wise, I've roughly completed
through (7), but this blog post is already super super long. You can check out the most current state of the code at
[https://github.com/ahl27/machineRy](https://github.com/ahl27/machineRy). I'm planning on updating it as I have time, so stay tuned!