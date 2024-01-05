---
title: "Fortran, C, and R"
date: 2024-01-05
permalink: /posts/2023/11/fortrancr/
tags:
  - blog posts
  - R
  - C
  - Fortran
---

First post of 2024! I wanted to take a little bit of time to talk about using C and Fortran in R.
I often feel like the documentation for using C is a little tough to find, and finding out how
to call Fortran from R is even harder. Is it even worth it, though? Should you be using Fortran
in your R code? And if you could write C, why would you bother with Fortran? Let's look through
them step by step, using two common sorting algorithms (quicksort and mergesort) as examples.

I'm including example code in all three languages, and then I'll benchmark their relative performance
at the end.

## Setup

For all of these examples, I'm going to be writing code to sort a vector of integers using
either quicksort or mergesort. The setup for these is pretty easy:

{% highlight R %}
len <- 1000L
randvec <- as.integer(sample(1:100, len, replace=TRUE))
{% endhighlight %}

We're preallocating the vector so that when we benchmark, we can ignore the time required
to make the testing vector. If you're unfamiliar with either sorting algorithm, they're both
divide-and-conquer algorithms. Quicksort works by picking a "pivot" and sorting the array
such that all values less than the pivot come before it, and all values larger come after.
We then recursively apply the same strategy to the values before and after the pivot (picking
new pivots) to sort the entire array. Mergesort works by first recursively partitioning the
array into smaller and smaller blocks, and then iteratively combining these blocks into sorted
order. You can check out example code here, or look at illustrated examples on Wikipedia
([Mergesort](https://en.wikipedia.org/wiki/Merge_sort), [Quicksort](https://en.wikipedia.org/wiki/Quicksort)).

## Starting Simple: R Code

If you're here, you probably already know how to write and execute R code. This is the biggest
benefit of R: it's (by definition) the easiest type of code to write and execute within R.
I'm going to use two sorting implementations in R. The first is the built-in `sort` method,
using `method='quick'` to call quicksort. This is basically just calling C on the backend,
so we should expect the performance to be roughly the same as a C implementation.

{% highlight R %}
base_r <- function(){
  sort(randvec, method='quick')
}
{% endhighlight %}

Now, I'm also going to add a raw R implementation to see what the difference between the
(basically C) base R implementation and typical user-written R code. I'm not guaranteeing
this is the most optimal implementation, but it does get the job done.

{% highlight R %}
rquicksort <- function(v){
  l <- length(v)
  if(l <= 2){
    if(l == 2 && v[1] > v[2])
      v <- rev(v)
    return(v)
  }
  pivot <- v[l %/% 2]
  v <- v[-(l%/%2)]
  leftv <- rquicksort(v[v < pivot])
  rightv <- rquicksort(v[v >= pivot])
  c(leftv, pivot, rightv)
}

r_quick <- function(){
  rquicksort(randvec)
}
{% endhighlight %}

## Moving up: C Code

C code can be called from R in three main ways. The first is to use R code that basically runs
C in the background, such as with built-in `base` functions like `sort`. However, oftentimes
there aren't base R functions for the use-case you want. In this case, we can write our own
functions in C and call them either using `.Call` or `.C`. `.Call` takes in R objects (referred
to as `SEXP` objects) and can return a new `SEXP` object, whereas `.C` takes in pointers to the
underlying C data behind R code, and modifies these values in-place. Functions called with `.C`
must be `void`, and are unable to allocate any R objects. Here's an example of a quicksort algorithm
implemented in a C file:

```c
#include <R.h>
#include <Rdefines.h>

// helper functions to be called by the main function (c_quicksort)
inline void swapval(int *vec, int i1, int i2){
  int tmp = vec[i2];
  vec[i2] = vec[i1];
  vec[i1] = tmp;
}

void c_quicksort_helper(int *vec, int n){
  if(n <= 2){
    if (n==2 && vec[1] < vec[0])
      swapval(vec, 0, 1);
    return;
  }
  int pivot = n / 2;
  int pivotval = vec[pivot];
  int tempind = 0;

  // swap out the pivot point to the final element
  swapval(vec, n-1, pivot);

  for(int i=0; i<n-1; i++){
    if(vec[i] < pivotval){
      if(i > tempind) swapval(vec, i, tempind);
      tempind++;
    }
  }

  swapval(vec, tempind, n-1);
  c_quicksort_helper(vec, tempind);
  c_quicksort_helper(vec+tempind+1, n-tempind-1);
}

// note that all the inputs are pointers
void c_quicksort(int *vec, int *n){
  int len = n[0];
  c_quicksort_helper(vec, len);
}
```

To be able to use this in R, we first have to compile it into a format
R can understand. Assuming I saved the above in a file called `cquick.c`,
we can compile it by using `R CMD SHLIB cquick.c -o cquick.so` on the commandline.
This will create a shared object (`.so`) file called `cquick.so` in the same directory.
Once we've done this, we can call it from R with:

{% highlight R %}
# first, load the shared object file
dyn.load('cquick.so')

# this a void function, so we'll call it with .C
c_quick <- function(){
  .C("c_only_quick", randvec, len)[[1L]]
}
{% endhighlight %}

## Finally, Fortran

C and R are pretty commonly used together, but I personally had quite a bit of trouble figuring out
how to add Fortran code to R. The initial appeal of Fortran to me is that Fortran syntax *feels* a lot
like R--it supports slice indexing, vectorized functions, all that good stuff. Unlike C, you don't
have to worry too much about memory or managing pointers. Let's write a quicksort routine in Fortran first:

```fortran
subroutine fquicksort(x, n)
  implicit none
  integer, intent(in) :: n
  integer, intent(inout) :: x(n)
  call helpersort(x, n)
end subroutine fquicksort

recursive pure subroutine helpersort(x, n)
  implicit none
  integer, intent(in) :: n
  integer, intent(inout) :: x(n)
  integer :: p, pless, pgr

  ! return if array is less than 3 long
  if(n <= 2) then
    ! if it's 2 long, make sure they're sorted
    if (n == 2 .and. x(2) < x(1)) x(:) = x(2:1:-1)
    return
  end if

  ! pivot here is just the center of the array
  p = x(n/2)

  ! replacing values using pack() -- returns subset of array defined by mask (always 1D)
  x(:) = [pack(x, x < p), pack(x, x==p), pack(x, x > p)]

  ! count up how many we have less than and greater than
  pless = count(x < p)
  pgr = count(x > p)

  ! recursive calls
  call helpersort(x(:pless), pless)
  call helpersort(x((n-pgr+1):), pgr)
end subroutine helpersort
```

Here we have two subroutines, and if you strip away all the Fortran setup stuff (e.g., variable declaration
and function annotations), the result is pretty similar to R code. `pack(x, x<p)` is equivalent to
`x[x<p]`, and the rest is pretty similar to R. If you can write something in R code, it's (to me at least)
much easier to translate it to Fortran than to R.

Now, how do we call it from R? We're going to compile it the same way, using
`R CMD SHLIB fquick.f90 -o fquick.so`, and then we use almost the same syntax:

{% highlight R %}
# first, load the shared object file
dyn.load('fquick.so')

# this a void function, so we'll call it with .C
fortran_quick <- function(){
  .Fortran("fquicksort", x=randvec, n=len)$x
}
{% endhighlight %}

There are two main differences between calling this and calling the C implementation. First, we use
`.Fortran` instead of `.C`--that difference should be pretty self-explanatory. Second, we provide
named arguments and get the returned value with `$x`. It's possible to call Fortran code in the same
way as `.C`, using `.Fortran('fquicksort', randvec, len)[[1L]]`, but Fortran also supports providing
named arguments. When you do, the returned list will also be named, which lets us get the returned value
using `$x`.

Now, it's also possible to call Fortran within C code called from R. That seems like it may be overcomplicating
things, but often it can be faster to call to Fortran than to callback to R. In the event you need to do something
that C doesn't do super well, it can be useful to make small subroutine calls to Fortran within larger
C functions. I'm going to provide a mergesort implementation here that's called from C--there are a couple
things to be aware of when doing this.

First, the Fortran code:

```fortran
! Fortran subroutine to run mergesort
module fmergemod
  implicit none
  private
  public fmergesort

contains
  pure subroutine fmergesort(x, n) bind(C, name="fmerge")
    ! use c-compatible types
    use, intrinsic :: iso_c_binding, only: c_int
    implicit none
    integer(c_int), intent(in) :: n
    integer(c_int), intent(inout) :: x(n)
    call helpermsort(x, n)
  end subroutine fmergesort

  recursive pure subroutine helpermsort(x, n)
    use, intrinsic :: iso_c_binding
    implicit none
    integer(c_int), intent(in) :: n
    integer(c_int), intent(inout) :: x(n)

    integer(c_int) :: center, temparr(n), il, ir, j

    if(n == 1) return

    ! get the center of current array, may not be exact
    center = n / 2

    ! recursive call on left and right sides
    call helpermsort(x(:center), center)
    call helpermsort(x((center+1):), n-center)

    ! sort the two halves into a complete value
    il = 1
    ir = center+1
    do j=1, n
      if(il > center .or. (ir <= n .and. x(ir) <= x(il))) then
        temparr(j) = x(ir)
        ir = ir+1
      else
        temparr(j) = x(il)
        il = il+1
      end if
    end do

    x(:) = temparr
  end subroutine helpermsort
end module fmergemod
```

Wrapping subroutines in modules is generally encouraged, so that's what we've done here.
A couple things to note:

1. We have to use C-compatible types, which we do with the `iso_c_binding` intrinsic. Integer variables are marked with `integer(c_int)` (other C types are supported in ways you'd expect, e.g., `c_double`).
2. We have to make sure the function we'll call from C is marked as `public`.
3. We specify that C-callable functions are bound to C using `bind(C, name="xyz")`. This makes the function available to C and callable as `xyz()`.

Now we have to call it from C. This code is much shorter:

```c
#include <R.h>
#include <Rdefines.h>

extern void fmerge(int *x, int *n);

SEXP run_fmerge(SEXP VEC, SEXP LEN){
  int *v = INTEGER(VEC);
  int *l = INTEGER(LEN);

  // note that we can only pass POINTERS
  // passing int instead of int * will break
  fmerge(v, l);

  return(VEC);
}

void better_fmerge(int *vec, int *n){
  fmerge(vec, n);
}
```

I've included both an example of using the `.Call` syntax (`run_fmerge`) and the `.C` syntax (`better_fmerge`).
`.C` is a better approach for this specific example, but using `.Call` is much more common. Note that we've
protyped the Fortran function using `extern void fmerge(...)`, and made sure that all the arguments to our
Fortran function are pointers. The function itself is defined within Fortran, so we have to compile them
together. Let's assume they're called `fmerge.f90` and `fmerge.c`, then we make our shared library with
`R CMD SHLIB fmerge.f90 fmerge.c -o fmerge.so`. Once we've done that, calling it from R is the same as the C example:

{% highlight R %}
# first, load the shared object file
dyn.load('fmerge.so')

cfortran_merge <- function(){
  .C("better_fmerge", randvec, len)[[1L]]
}
{% endhighlight %}

## How do they compare?

The real question is, how do they compare? We have five total functions: two in R, one in C, and
two in Fortran. Let's benchmark them with the `microbenchmark` package (truncating results to just
the median and mean):

{% highlight R %}
microbenchmark::microbenchmark(
  fortran_quick(),
  cfortran_merge(),
  c_quick(),
  r_quick(),
  r_default()
)

# Benchmark:
# Unit: microseconds
#          function       mean    median
#   fortran_quick()  192.83202  107.3585
#  cfortran_merge()   94.31681   87.6375
#         c_quick()   20.36306   13.4685
#          r_base()   37.37314   26.6090
#         r_quick() 1318.25906 1146.4215
{% endhighlight %}

Now, these aren't all the same algorithm, but they are relatively comparable in
algorthmic complexity. Let's break down the results, focusing on the median runtimes.

First, `c_quick` and `r_base` are almost identical. As mentioned before, R's `sort()`
function is basically just C anyway, so it's not surprising that these are about the
same. Both flavors of Fortran (`fortran_quick`, called from R, and `cfortran_merge`,
called from C from R) perform about the same, around 5x slower than the C implementation.
Finally, the strict R implementation `r_quick` is by far the slowest, clocking in at roughly
10x slower than the Fortran methods and about 50x slower than the C implementations.

All this is to say: **C is definitely the fastest, and Fortran is relatively close.**
If you need ultra-high performant code, C is likely your best option. However,
if you're writing code that's tough to write in C, you can strike a nice balance
between performance and ease of coding using Fortran. If you're a Fortran wizard
and can optimize your code more, you can probably approach C performance. I won't
pretend that these are heavily optimized implementations, but they're good enough
to get rough estimates of relative performances.

I feel like people tend to stick too much to the languages they're familiar with.
Having a diverse set of tools in your toolbox gives you more options to attack problems with.
Have proficiency in Fortran, C, and R together gives you the ability to maximize
runtime without sacrificing too much readibility. Give Fortran a try, you may find that it's
easier than it seems. Happy Coding!