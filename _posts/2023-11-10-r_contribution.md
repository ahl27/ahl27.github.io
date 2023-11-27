---
title: "`dendrapply` and How To Contribute to R"
date: 2023-11-10
permalink: /posts/2023/11/r-project-sprint/
tags:
  - blog posts
  - R
---

If you've been following my blog posts, you know that I previously [refactored R's `dendrapply` function](https://www.ahl27.com/posts/2023/02/dendrapply/). After some initial feedback from R-devel, I was encouraged to apply for the [R Project Sprint](https://contributor.r-project.org/r-project-sprint-2023/) at the University of Warwick in the UK.

![](/images/r-project-2023.png)

What an incredible experience! I had the opportunity to meet many members of R Core, and got to show my code to people much smarter than me. Most notably, I had the chance to show my `dendrapply` implementation to the original author of the function, Martin Maechler. I've updated my code significantly since then, so I thought it would be a good idea to walk through how people can contribute to R. If you're just interested in the current state of `dendrapply`, you can check it out on [Bugzilla](https://bugs.r-project.org/show_bug.cgi?id=18480).

## Getting your feet wet

The top advice for people learning a new language is to immerse yourself in it. Surrounding yourself with examples of a new language is incredibly helpful for learning, especially if those examples come from native speakers. The same is undoubtedly true of R; immersing yourself in the R development community helps learn the ins and outs of contribution.

There exist a number of R mailing lists (see [here](https://www.r-project.org/mail.html)). The most important of these is arguably `R-devel`, in which developers discuss contributions, bugs, and changes to the main R codebase. This mailing list gets quite a bit of traffic from the R-core team, as well as other excellent developers in the community.

The other main source of information is the codebase itself. R is maintained on subversion, but a mirror of the current codebase is available [on GitHub](https://github.com/r-devel/r-svn). On there you can see all the internals of R...though if you're like me, that's probably quite a lot to take in all at once. Reasonbly good explanations for how the internals work can be found in the [Writing R Extensions](https://cran.r-project.org/doc/manuals/R-exts.html) guide, as well as [Hadley Wickham's guide](https://github.com/hadley/r-internals).

## Tracking down the source code

Okay, now we know a little bit about the internals of R. However, the codebase is still enourmous; how do we go about identifying *how* a particular part of R works?

If we're looking at R code, the process is relatively simple. From within R, you can typically view the source code for a given method by just typing the name of the method without `()`. For example:

```
> lapply
function (X, FUN, ...)
{
    FUN <- match.fun(FUN)
    if (!is.vector(X) || is.object(X))
        X <- as.list(X)
    .Internal(lapply(X, FUN))
}
<bytecode: 0x11d0e6798>
<environment: namespace:base>
```

In this case, typing `lapply` returns the internal definition of the function, as well as the namespace it lives in (in this case, `base`). Most of the builtin R namespaces can be found within `/src/library`--for example, `base` is found in `/src/library/base`, and the code for `lapply` is found in `/src/library/base/R/lapply.R`.

Unfortunately, `lapply` calls `.Internal(lapply(X, FUN))`, which means there's also some C code to be analyzed. C code can be tricker to track down, but most of it is found in `/src/main`. On the command line, we can use `grep` to search for lines within files. Let's try looking for the source code for `lapply`:

```
bash$ grep -n -e "lapply" src/main/*

src/main/apply.c:33:/* .Internal(lapply(X, FUN)) */
src/main/apply.c:41:attribute_hidden SEXP do_lapply(SEXP call, SEXP op, SEXP args, SEXP rho)
src/main/builtin.c:1047:  /* There is a complication: if called from lapply
src/main/coerce.c:1977:    necessarily correct, e.g. when called from lapply() */
src/main/deparse.c:918:   // := structure(lapply(slotNms, slot, object=s), names=slotNms)
src/main/envir.c:3023: * Equivalent to lapply(as.list(env, all.names=all.names), FUN, ...)
src/main/logic.c:479:        One exception is perhaps the result of lapply, but
src/main/names.c:658:{"lapply", do_lapply,  0,  10, 2,  {PP_FUNCALL, PREC_FN, 0}},
src/main/saveload.c:2314: val <- lapply(list, get, envir = envir)
src/main/saveload.c:2318:   Unfortunately, this will result in too much duplication in the lapply
```

`-n` tells `grep` to return line numbers, and `-e` tells it to use a regular expression. You can also use the `-r` flag to search recursively through directories.

In this case, we get a bunch of values returned. Most of them are comments, but two of these lines are important. `src/main/names.c:658:...` tells us that, on line 658 of `src/main/names.c`, the call `.Internal(lapply(...))` calls `do_lapply`. It just so happens that the definition of `do_lapply` can be found on line 41 of `src/main/apply.c`, as shown by our `grep` call. If we wanted to investigate further, we could open those files and look at what's going on internally.


## Reporting bugs

Now we sort of understand R and can find the source code for a given function. The process for fixing bugs looks like the following:

1. Make sure the bug is actually a bug
2. Make absolutely sure the bug is real
3. Make sure you can reproduce the bug on current R with a clean environment
4. Do 1-3 again
5. Check with the community to make sure you did (1-3) right
6. Report the bug on Bugzilla, potentially with a patch

If it isn't apparent, be really sure you've actually found a bug and haven't just done something dumb (like the one time I accidentally overwrote the value of `c`). If you're unsure, you can ask on the [R Contributors Slack channel](https://contributor.r-project.org/slack) or email `r-devel`. Once you have a bug and can reproduce it, use [Bugzilla](https://bugs.r-project.org/) to report the bug along with a minimal working reproduction of the problem.

If you've cloned the `r-source` repository, you can create a patch by first changing the codebase, then using `git diff upstream/master > PatchFile.diff`. This will create a patch file called `PatchFile.diff` with your changes. Before submitting, make sure to test your patch! The easiest way to do this is with Docker, though if you have a Linux machine you should be able to do this without spinning up a VM. You can download the most up-to-date R source and apply your patch with:

```
svn checkout https://svn.r-project.org/R/trunk`
cd trunk
svn patch /path/to/PatchFile.diff
./configure --with-readline=no --with-x=no --without-recommended-packages && make
./bin/R
```

The second to last line builds R, and the last one runs your (patched) version of R. This often requires a lot of dependencies; you can use a prebuilt docker container I've created that has them all installed with these commandline commands:

```
docker pull peiple/r-sandbox
docker run -it --rm -v /PATH/TO/LOCAL/PATCH/FILE:/UserData peiple/r-sandbox
```

This will drop you in a Linux VM with all dependencies already installed, and then you can `svn checkout` and `svn patch` as normal.

## The state of `dendrapply`

`dendrapply` has been updated and uploaded to Bugzilla (see [here](https://bugs.r-project.org/show_bug.cgi?id=18480)). This version has a lot of bugfixes as compared to the code uploaded in my original blog post, and should be ready for integration into R. Since it's a relatively large change, the review process takes a while--I'm talking with R-core about what the best decision is regarding `dendrapply`. We may instead end up refactoring it into an R implementation (without C code) if some proposed changes from Luke Tierney are integrated. TBD!