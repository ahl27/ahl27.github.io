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

I've recently had to implement random forests from scratch in R. This is a much longer post than I normally make, since I'm going to go through all the details of actually implementing one of these models. By "from scratch", I mean a complete Random Forest prediction model, written in R, with no packages aside from those provided in a base installation.

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

Note to anyone planning to seriously follow this writeup: I use R, Fortran, and C together for my implementation.
If you're unfamiliar with R internals or the various ways to interface between R and Fortran/C, you may have trouble
following some sections. I recommend looking at what is essentially the bible of R programming,
[Writing R Extensions](https://cran.r-project.org/doc/manuals/R-exts.html), for a comprehensive description on things
like `.Call` syntax and Fortran interfaces. If you're interested in a more comprehensive description of Random Forests,
check out [the original publication by Leo Breiman](https://link.springer.com/article/10.1023/A:1010933404324).

**This will be a work in progress until I finish my implementation**

You can check out the current codebase at [https://github.com/ahl27/machineRy](https://github.com/ahl27/machineRy).
If you have suggestions for improvements, feel free to contact me or open an issue on GitHub.

## Step 0: Planning

This is a big project, and I'm looking for a good, robust implementation. For things like this, the best first step is
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
SEXP R_get_treeptr(SEXP VolatilePtr, SEXP INDICES, SEXP THRESHOLDS, SEXP GINIS){
  // if tree exists, just return the external pointer
  // note that it seems R_NilValue can be treated as an external pointer address for whatever reason
  if(VolatilePtr != R_NilValue && R_ExternalPtrAddr(VolatilePtr)) return(VolatilePtr);

  // otherwise, create the tree
  DTN *tree = bfs_q2tree(INTEGER(INDICES), REAL(THRESHOLDS), REAL(GINIS), LENGTH(INDICES));
  // using LENGTH because it makes calling the function a lot easier --
  // could be optimized slightly by calculating this on the R end

  int madePtr = 0;
  if(VolatilePtr == R_NilValue){
    // if the pointer is just NULL, we make a pointer for it
    VolatilePtr = PROTECT(R_MakeExternalPtr(tree, R_NilValue, R_NilValue));
    madePtr = 1;
  } else {
    // else just set the address of the pointer to the tree we just made
    R_SetExternalPtrAddr(VolatilePtr, tree);
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

## Step 2: Making Decision Tree Nodes

At this point, I have a data structure and a way to read it to/from R. It also can be saved across multiple R sessions.
The next step is creating one of the building blocks of decision trees: the nodes it contains.

There are many ways to build decision trees, but the most well-known is the CART (Classification and Regression Trees)
algorithm. I first tried to figure out what they're doing in the `randomForest` package, but their code is...extremely
difficult to understand. In absence of that, I instead just started implementing based on what it should theoretically
look like.

The CART algorithm for each node of a classification tree in a random forest is fairly straightforward:

1. Randomly choose `n` variables to evaluate
2. For each variable, determine the split point that maximizes the Gini Gain
3. Split the data on the variable/threshold combination that maximizes Gini Gain

You can see that a lot of this revolves around the "Gini Gain", but what exactly is that? Gini Gain is derived from the
[Gini Impurity](https://en.wikipedia.org/wiki/Decision_tree_learning#Gini_impurity), which measures "how often a randomly
chosen element of a set would be incorrectly labeled if it were labeled randomly and independently according to the
distribution of labels in the set" (Wikipedia, see previous link). The mathematics work out very cleanly, so the expression
for Gini Impurity is just:

```
1 - sum_i(p_i^2)
```

Here `p_i^2` is the probability of each class in the training set, and `sum_i` is the sum over all categories. Essentially,
you take one minus the sum of squared probabilities for each class. The best possible value is 0, when all elements are in the
same class.

Gini Gain is then just the Gini Impurity of the total dataset minus the weighted Gini Impurity of each branch after the split.
To illustrate this, let's walk through an example. Suppose I have a set of three classes, `{A,B,C}`, and my starting dataset is:
```
{A, A, A, A, B, B, C, C, C}
```

The gini impurity is then one minus the squared sum of probabilities for each class. The probabilities for `A,B,C` are
`4/9, 2/9, 3/9` (respectively), so the Gini impurity is:
```
  1 - ((4/9)^2 + (2/9)^2 + (3/9)^2)
= 1 - (16/81 + 4/81 + 9/81)
= 1 - 29/81
= 52/81
```
That's about equal to 0.642.

Now, let's say that we pick some split point that divides our dataset into two groups: `{A, A, A, A, | B, B, C, C, C}`.
The left side has all the elements from classes `A`, and the right has all from `B,C`. The Gini Impurity of the right and
left are then:
```
Gini(left):
    1 - ((4/4)^2)
  = 1 - (1^2)
  = 1 - 1
  = 0

Gini(right):
    1 - ((2/5)^2 + (3/5)^2)
  = 1 - (4/25 + 9/25)
  = 1 - 13/25
  = 12/25
```

Now the Gini Gain of this split is the Gini Impurity at the beginning (0.642) minus the sum of *weighted* Gini Impurities
of the left and right nodes. This weighting is done by the number of elements in each node. In this case, since we split
our set of nine elements into two sets of size four and five (resp.), the final calculation is:
```
Gini Gain:
    GiniImpurity(parent) - (weightedGini(left) + weightedGini(right))
  = 52/81 - ((4/9)(0) + (5/9)(13/25))
  = 52/81 - (0 + 65/225)
  = 52/81 - 13/45
  = 143/405
```

So our Gini Gain is 143/405, which is about 0.353. By maximizing the Gini Gain, we'll consistently pick split points that reduce the
Gini Impurity as much as possible. This is because the maximizing the Gini Gain corresponds to picking split points wherein the
Gini Impurity of the child nodes is smallest relative to the Gini Impurity of the parent.

To illustrate this, if we had picked a
partition that split our nodes into `{A, A, B, C, C | A, A, B, C}`, the Gini Impurity of the child nodes would be 9/25 for the left
and 6/16 for the right. Our Gini Gain would be `52/81 - [(5/9)(9/25) + (4/9)(6/16)] = 223/810 = 111.5/810`, which is about 0.275.
This is a worse score than our previous example, and it corresponds to a case where the elements of the set are much less well
separated.

Let's get back to coding. The first step was making a function to calculate the Gini Impurity of a vector of classes. I chose
Fortran for this, since matrix operations are a little easier to write in Fortran.

```fortran
pure subroutine gini_imp(classes, l, nclass, o_v)
    ! calculate gini impurity of a given vector of classes
    ! variable definitions:
    ! classes: vector of classes (integer, 1:n)
    !       l: length of `classes`
    !  nclass: number of unique classes
    !     o_v: output variable
    use, intrinsic :: iso_c_binding, only: c_int, c_double
    implicit none
    integer(c_int), intent(in) :: l, nclass
    integer(c_int), intent(in) :: classes(l)
    real(c_double), intent(out) :: o_v

    real(c_double) :: class_counts(nclass), total
    integer(c_int) :: i
    if(l == 0) then
      o_v = 1.0
      return
    end if

    ! tabulate number of classes
    do i=1, nclass
      class_counts(i) = 0.0+count(classes==i) ! cast to double for later
    end do

    total = sum(class_counts)

    ! gini impurity is 1 - (squared probabilities)
    o_v = 1.0-sum((class_counts / total)**2)
  end subroutine gini_imp
```

This gives us a way to calculate the Gini Impurity given a single vector. Now, we just have to apply it to a
set of observations to find the optimal split point for a given variable:

```fortran
pure subroutine find_gini_split(v, response, l, nclass, o_v, o_gini_score) bind(C, name="find_gini_split_")
    ! Variable declarations:
    !            v: vector of values to split on (numeric)
    !     response: classes of each entry
    !            l: length of v and responses
    !       nclass: number of unique classes
    !          o_v: (output) value to split on
    ! o_gini_score: (output) Gini Gain of split
    use, intrinsic :: iso_c_binding, only: c_int, c_double
    implicit none

    integer(c_int), intent(in) :: l, nclass
    integer(c_int), intent(in) :: response(l)
    real(c_double), intent(in) :: v(l)
    real(c_double), intent(out) :: o_gini_score, o_v

    integer(c_int) :: i, mloc
    real(c_double) :: total_gini, gains(l)
    logical :: tmpmask(l)

    ! calculate the base gini impurity
    call gini_imp(response, l, nclass, total_gini)
    gains(:) = total_gini

    ! Calculate the gini gain for every possible split point
    do concurrent(i=1:l)
      tmpmask(:) = v <= v(i)
      if(count(tmpmask) == l) then
        gains(i) = -1.0
      else
        call gini_imp(pack(response, tmpmask), count(tmpmask), nclass, total_gini)
        gains(i) = gains(i) - (total_gini * count(tmpmask)) / l
        tmpmask(:) = .not. tmpmask
        call gini_imp(pack(response, tmpmask), count(tmpmask), nclass, total_gini)
        gains(i) = gains(i) - (total_gini * count(tmpmask)) / l
      end if
    end do

    ! find the best split and the gini gain of that split
    gains = gains / l
    mloc = maxloc(gains, dim=1)
    o_v = v(mloc)
    o_gini_score = gains(mloc)
  end subroutine find_gini_split
```

This gives us a way to calculate the best split point for a given variable. The final step is just determining what variables to pass to Fortran from C.

```c
void split_decision_node_classif(DTN *node, double *data, int *class_response,
                                  int nrows, int ncols, int nclass, int num_to_check){
  // data should always be a numeric
  // response should be an int ranging from 1:n
  // nclass, num_to_check are constant throughout execution of the program

  // data will be a matrix stored by column (first nrows entries are col1, second are col2, etc.)
  // we'll just assume that all the preprocessing is done in R, no need to fiddle with that here
  // processing the SEXPs will be done separately so we can repeatedly call this internally

  // setting up a random sample of ints
  int *cols = malloc(sizeof(int) * ncols);
  for(int i=0; i<ncols; i++) cols[i] = i;
  int choice, tmp;

  // shuffle the columns, use R's random number generator
  // this is a Fisher-Yates shuffle, for anyone interested
  GetRNGstate();
  for(int i=ncols-1; i>0; i--){
    choice = floor(unif_rand()*i);
    tmp = cols[choice];
    cols[choice] = cols[i];
    cols[i] = tmp;
  }
  PutRNGstate();

  double *results = malloc(sizeof(double) * num_to_check);
  double *gini_gain = malloc(sizeof(double) * num_to_check);
  double curmax = -0.5;
  choice = -1;
  for(int i=0; i<num_to_check; i++){
    // call Fortran to find the best split point
    F77_CALL(find_gini_split)(&data[nrows*cols[i]], class_response, &nrows, &nclass, &results[i], &gini_gain[i]);
    if(gini_gain[i] > curmax){
      choice = i;
      curmax = gini_gain[i];
    }
  }

  // assign the threshold, index, and gini gain to the node
  node->threshold = results[choice];
  node->index = cols[choice];
  node->gini_gain = curmax;

  // cleanup
  free(results);
  free(gini_gain);
  free(cols);
  return;
}
```

And now we have a way to determine a split point in the nodes. Next up is doing it a bunch of times to generate a full
decision tree.

If you actually implement this and try it out, you'll find a couple issues. First, the runtime is abysmal compared to `randomForest`. Second, the performance is middling. Third, it only works on classification--Gini Gain isn't really defined for regression. These aren't huge issues, though; the priority is getting something working that we can refine later. I'll come back to optimizing these methods once the whole algorithm is working.

## Step 3: Making Decision Trees

The next step is building a decision tree for some input data. My goal is getting a working model, so I'm going to just focus on an easier problem subset. I'll assume that input data are a matrix of `numeric` values (`double` in C), and the output is a vector of `integer` (`int` in C) corresponding to which class each row belongs to. This isn't actually that much of a simplification--R's `formula` parsing will transform the inputs into a matrix of `numeric` values anyway.

We already have a way to calculate a split at each node, so we need to do two more things to make a decision tree:

1. Create a node object and populate it with the correct split point and index
2. Split up the matrix of data according to the split point

This function is going to be called recursively, so I'm also going to be sure to call `R_CheckUserInterrupt()` to make sure that if the user wants to stop early, it actually exits. The code here is going to be into a few parts.

First, let's do some preliminary checking on the classes themselves. If they're all the same class, we can just finish. Additionally, if we're already past the maximum depth specified by the user, we should stop splitting. I'm intentionally going to check if `cur_depth == max_depth` rather than using `cur_depth > max_depth` so that we can use `max_depth=-1` to have no maximum.

First, let's call the function we wrote earlier to find a split point:

```c
void learntreeclassif_helper(DTN *node, double *data, int *class_response,
                              int nrows, int ncols, int nclasses, int num_to_check,
                              int cur_depth, int max_depth, int min_nodesize){

  // Error checking and stuff is going to go here
  // ...

  // this will assign the splitpoint and stuff into node
  split_decision_node_classif(node, data, class_response,
                              nrows, ncols, nclasses, num_to_check);
```

That takes care of (1), so now we need to split up the data and call the function for the node's children.

```c
  // How big do we need the new arrays to be?

  // get the values we just found
  double splitpoint = node->threshold;
  int ind = node->index;
  double *v = &data[nrows*ind];

  // determine how many rows the data passed to left/right nodes will have
  int nrow_left = 0, nrow_right=0;
  for(int i=0; i<nrows; i++){
    if(v[i] <= splitpoint)
      nrow_left++;
    else
      nrow_right++;
  }

  // allocate space for data and classes
  double *left_data = malloc(sizeof(double) * nrow_left*ncols);
  double *right_data = malloc(sizeof(double) * nrow_right*ncols);
  int *left_class = malloc(sizeof(int) * nrow_left);
  int *right_class = malloc(sizeof(int) * nrow_right);
  int ctr_l=0, ctr_r=0;

  // traverse the data, adding each row to the left or right data matrices
  for(int i=0; i<nrows*ncols; i++){
    if(v[i%nrows] <= splitpoint){
      left_data[ctr_l] = data[i];
      if(ctr_l < nrow_left)
        left_class[ctr_l] = class_response[i%nrows];
      ctr_l++;
    } else {
      right_data[ctr_r] = data[i];
      if(ctr_r < nrow_right)
        right_class[ctr_r] = class_response[i%nrows];
      ctr_r++;
    }
  }

  // create a new left and right node, then call function recursively
  DTN *left_node = initNode();
  DTN *right_node = initNode();

  // left node
  learntreeclassif_helper(left_node, left_data, left_class, nrow_left,
                          ncols, nclasses, num_to_check, cur_depth+1,
                          max_depth, min_nodesize);
  // right node
  learntreeclassif_helper(right_node, right_data, right_class, nrow_right,
                          ncols, nclasses, num_to_check, cur_depth+1,
                          max_depth, min_nodesize);

  node->left = left_node;
  node->right = right_node;

  return;
}
```

That's the brunt of the function. If you've used C before, you'll notice a bunch of problems here. First, lots of `malloc` calls without any `free` calls. We'll be leaking memory all over the place. Combine that with the fact that our recursion never ends, and we'll be crashing CPUs left and right. Since this tutorial is already extremely long, I'm going to omit the code and do what every math student dreams of: leave it as an "exercise to the reader".

Here's a sketch of how the function works:

1. Check if we should stop recursion. More specifically, are the entries all the same class? Are we deeper than the specified max depth? Do we have fewer rows than the `nodesize` parameter?
2. Try to split the node
3. Check if we made a split. If every split increases the Gini Impurity, then we can't make any more good splits and we should just return.
4. If we made a split, allocate space for the children nodes and recurse.

The other little blip is the memory (de)allocation. My solution was to free `data` and `classes` ASAP in the function itself. Since we copy values into `left_data`, `right_data`, `left_class`, and `right_class`, we don't really need `data` or `classes` anymore. Copy the data into new containers, free the old ones, pass the new ones to the recursion.

Oh, and we need an R interface:

```
SEXP R_learn_tree_classif(SEXP DATA, SEXP NROWS, SEXP NCOLS, SEXP CLASSES, SEXP NCLASSES, SEXP TO_CHECK, SEXP MAX_DEPTH, SEXP MIN_NODESIZE){
  // array input
  double *data = REAL(DATA);
  int *class_response = INTEGER(CLASSES);

  // variable inputs
  int nrows = INTEGER(NROWS)[0];
  int ncols = INTEGER(NCOLS)[0];
  int nclasses = INTEGER(NCLASSES)[0];
  int num_to_check = INTEGER(TO_CHECK)[0];
  int max_depth = INTEGER(MAX_DEPTH)[0];
  int min_nodesize = INTEGER(MIN_NODESIZE)[0];

  // internal vars
  DTN *head = initNode();

  // helper function will destroy data and class_response, so duplicate them first
  double *dup_data = malloc(sizeof(double)*nrows*ncols);
  int *dup_class_response = malloc(sizeof(int)*nrows);

  // these do not need to be free'd -- will be free'd in the helper function
  dup_data = memcpy(dup_data, data, sizeof(double)*nrows*ncols);
  dup_class_response = memcpy(dup_class_response, class_response, sizeof(int)*nrows);

  learntreeclassif_helper(head, dup_data, dup_class_response, nrows, ncols, nclasses,
                          num_to_check, 0, max_depth, min_nodesize);

  // now we should have our entire tree created, and our duplicated arrays destroyed.

  // Now let's export it to an R object

  // these objects will be allocated in `export_internal_tree`
  int *indices = NULL;
  double *thresholds = NULL, *gini_gain=NULL;
  int l = 0;
  export_internal_tree(head, &indices, &thresholds, &gini_gain, &l);

  // This is one option, I'm instead just going to register the external
  // pointer right away and return it, since I think that's easier.
  // Avoids a double call, and most people will predict right after
  // training anyway.

  // Read values back into R
  SEXP R_retval = PROTECT(allocVector(VECSXP, 4));
  SEXP R_indices = PROTECT(allocVector(INTSXP, l));
  SEXP R_thresholds = PROTECT(allocVector(REALSXP, l));
  SEXP R_gini = PROTECT(allocVector(REALSXP, l));

  memcpy(INTEGER(R_indices), indices, sizeof(int)*l);
  memcpy(REAL(R_thresholds), thresholds, sizeof(double)*l);
  memcpy(REAL(R_gini), gini_gain, sizeof(double)*l);
  free(indices);
  free(thresholds);

  SET_VECTOR_ELT(R_retval, 1, R_indices);
  SET_VECTOR_ELT(R_retval, 2, R_thresholds);
  SET_VECTOR_ELT(R_retval, 3, R_gini);
  UNPROTECT(3);

  // register the external pointer and then return
  SEXP R_ptr = PROTECT(R_MakeExternalPtr(head, R_NilValue, R_NilValue));

  // R_TreeFinalizer just deallocates all the memory allocated to the decision tree
  R_RegisterCFinalizerEx(R_ptr, (R_CFinalizer_t) R_TreeFinalizer, TRUE);
  SET_VECTOR_ELT(R_retval, 0, R_ptr);
  UNPROTECT(2);

  return(R_retval);
}
```

## Steps 4-7: Making Random Forests

Yes, I'm going to combine these steps into a single section. They're all quick, so they can be combined.

Making a random forest is pretty simple. Random forest trees are actually easier than single decision trees, since Breiman's implementation for random forests skips pruning the trees. Thus, we basically just loop from `1:n` for `n` trees, and make each of them with a sample of the data. All we need to do for that is just use `sample` in R, then pass the values to the C functions we've made.

I wish I could write more about `formula` objects. The truth is, they're kind of a black box to me. Whenever I work with formulas, I usually just adapt the first few lines of `glm()` or `lm()` to parse the formula objects.

```
parse_formula <- function(formula, data, weights, na.action){
  ## copying a lot of this from glm()
  if(missing(data))
    data <- environment(formula)
  mf <- match.call(expand.dots=FALSE)
  m <- match(c("formula", "data", "subset", "weights", "na.action"),
             names(mf), 0L)
  mf <- mf[c(1L, m)]
  mf$drop.unused.levels <- TRUE
  mf[[1]] <- quote(stats::model.frame)
  mf <- eval(mf, parent.frame())
  if(identical(method, "model.frame"))
    return(mf)
  mt <- attr(mf, 'terms')
  y <- model.response(mf, "any")
  if(length(dim(y)) == 1L){
    nm <- rownames(y)
    dim(y) <- NULL
    if(!is.null(nm))
      names(y) <- nm
  }
  if(!is.empty.model(mt))
    x <- model.matrix(mt, mf, contrasts)
  else
    x <- matrix(NA_real_,nrow(y), 0L)
  weights <- as.vector(model.weights(mf))

  # do other stuff
}
```

This is roughly how most of R's `base` code parses `formula` objects. At the end of this function, `x` will store the input data as a `numeric` matrix with consistent variable names and ordering. Storing the formula will allow us to make similar data structures for predictions:

```
predict.RandForest <- function(rf, newdata=NULL, na.action=na.pass){
  tt <- terms(attr(rf, 'formula'), data=newdata)
  noData <- (missing(newdata) || is.null(newdata))
  if(noData){
    x <- model.matrix(rf)
    mmDone <- TRUE
    return()
  } else {
    Terms <- delete.response(tt)
    m <- model.frame(Terms, newdata, na.action = na.action)
    x <- model.matrix(Terms, m, contrasts.arg=attr(rf, 'contrasts'))
    mmDone <- FALSE
  }

  nentries <- nrow(x)
  nc <- ncol(x)
  results <- matrix(0.0, nrow=nentries, ncol=length(attr(rf, "class_levels")))
  colnames(results) <- attr(rf, "class_levels")

  # do other stuff
}
```

Here `rf` is our model, and the `formula` object used to generate it is stored as `attr(rf, 'formula')`. I included the `contrasts` argument in case I add something that uses it later, but right now it should always be `NULL`.

Once we've parsed the formula into a consistent matrix, we just call our internal functions to build the tree. Prediction is a pretty simple routine as well:

```c
double predict_for_input(DTN *tree, double *data){
  DTN *tmp=tree;

  while(tmp->index != -1){
    if(data[tmp->index] <= tmp->threshold)
      tmp = tmp->left;
    else
      tmp = tmp->right;
  }

  return(tmp->threshold);
}
```

## Step 8: Optimization

So it's around this time that I decided I'd benchmark the runtime of my implementation against the `randomForest` package.
It turns out that mine is...bad. For evaluating a dataset with 1000 rows, `randomForest` took around 0.25 seconds, whereas
mine took...over 11 seconds. That's not great.

I decided to take some time to think about this a little more. The crux of the problem is in how we determine split points.
This is easily verifiable by just commenting out the logic to find Gini Gain and replacing it with constant assignments that
execute (basically) instantly. How would you go about optimizing the previous implementation?

First, some insights. My program runs around 50x slower than `randomForest`, so this isn't just a case of using less optimized
languages or functions--the algorithm itself is worse. I looked into it a little more, and came up with the following three
problems:

1. `find_gini_split` calls `gini_imp` twice per proposed threshold and creates two vectors. That could easily be a single vector and a single function call.
2. The logic to find a split point just checks for the highest raw Gini Gain. However, a negative Gini Gain means that our split is actually worse than we started. We should be stopping in these cases and just set the node to be a leaf node.
3. We're checking every single value in the vector as a possible threshold.

(1-2) are big improvements already--implementing these fixes brought my runtime down to just 0.55 seconds. That's better, but still double that of `randomForest`. The scaling of mine is also an issue; my algorithm slows down much faster than that of `randomForest`.

This is all (likely) because of (3). This implementation checking every possible value in the vector as a threshold is super super
inefficient. To see why, here are two examples.

First, imagine the predictor is just a simple true/false value. Our vector of values will be `n` long, with all values either 0
or 1. My implementation will check `n` different thresholds, even though we only really need to check a single one (whether or not the value is 0).

Second, imagine the predictor is some bimodal distribution, like sum of distinct normal distributions. Let's also assume that the
modes clearly distinguish between two classes. We'll try every possible threshold, but we could instead just check the values in
the center of the modes. There will be significantly fewer thresholds between the modes, and they'll also all be better split points
than any of the values around the modes.

In essence, I'm hinting at some smarter way to traverse the space. Neural networks often use gradient descent, but we unfortunately
do not have access to a closed form solution for the derivative of the Gini Gain. However, we can easily approximate it. I'm not
completely sure what the output space looks like, so I'm going to use a simulated annealing approach to traverse the space. In
pseudocode, this roughly looks like this:

```
current_threshold = mean(values)
temp_max = 100
current_gini = gini_imp(currentthreshold)
for i in (temp_max-1:0):
  shouldUpdate = false
  new_threshold = current_threshold + runif()
  new_gini = gini_imp(newthreshold)
  if new_gini < current_gini:
    shouldUpdate = true
  else:
    proposal_chance = exp( (new_gini - current_gini) / (1 - ((i)/tempmax)) )
    roll = runif()
    if roll <= proposal_chance:
      shouldUpdate = true

  if shouldUpdate:
    current_threshold = new_threshold
    current_gini = new_gini
```

Essentially, move around the space randomly and recalculate the Gini Impurity at the new point. If the Gini Impurity is less (meaning the Gini Gain would be larger), we take that as our new estimate. If the Gini Impurity is greater (Gini Gain would be less, a worse choice), we accept it with a probability proportional to the "temperature". The temperature isn't a real temperature, but it's a parameter that decreases our acceptance probability over time. The algorithm is a simulated version of metals annealing.

Using this, the accuracy of my implementation is roughly the same as `randomForest` (if not slightly better) on classification tasks with numeric variables. For some reason the accuracy of my algorithm drops significantly when categorical variables are added. I'm not yet quite sure why that happens, but it's next on my list to investigate.

## Conclusion

Conclusion? But we still have so much to go!

Yep. This takes me a while to write, and I'm also not completely done with the code. Code-wise, I've roughly completed
through (7), but this blog post is already super super long. You can check out the most current state of the code at
[https://github.com/ahl27/machineRy](https://github.com/ahl27/machineRy). I'm planning on updating it as I have time, so stay tuned!