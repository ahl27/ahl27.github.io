---
title: "Tutorials"
permalink: /tutorials/
author_profile: true
---

Here you'll find a compilation of tutorials I've put together, either for internal presentations with my lab or for conference presentations.

## [`froth`: Forth Programming in R](https://www.ahl27.com/froth)

Forth is one of my favorite programming languages. It's simultaneously powerful, elegant, low-level, and incorporates a relatively unique structure. `froth` is an R package I wrote to provide R users with a Forth environment to code in. In addition to supporting most Forth code, `froth` interfaces directly with R, allowing users to easily leverage stack-oriented algorithms directly from R. This tutorial parallels the fantastic [*Starting Forth*](https://www.forth.com/starting-forth/) textbook to introduce users to programming with `froth`-style Forth.

## [Introduction to Phylogenetics](https://www.ahl27.com/OtherTutorials/articles/BuildingTrees.html)

This tutorial is an introduction to constructing phylogenetic trees and covers common methods, the algorithmic processes behind them,
and R code implementations so you can follow along! This should be a good tutorial for anyone new to phylogenetics that wants to
dip their toes into the field.

## [Comparative Genomics with DECIPHER and SynExtend](https://www.ahl27.com/CompGenomicsBioc2022/)

This is a slightly more advanced tutorial put together for presentation at the Bioconductor 2022 conference in Seattle, WA.
This tutorial introduces users to many common analyses by walking them through a complete computational pipeline for comparative genomics.
Along the way, I demonstrate methods for sequence alignment, gene calling and annotation, finding clusters of orthologous
genes, and building phylogenetic trees from sequencing data. Once we've covered all of those topics, we'll use these methods
(and some new software written by yours truly) to identify coevolving gene clusters from a dataset of sequencing data in order to predict
novel gene function. This tutorial is more focused on code implementations than the Introduction to Phylogenetics tutorial.

## [Phylogenetic Tree Distance](https://www.ahl27.com/OtherTutorials/articles/ComparingTrees.html)

This tutorial builds off the Intro to Phylogenetics tutorial by showcasing a number of methods for comparing phylogenies. Phylogenies are notoriously difficult to compare due to their complex topolgy, and a number of methods have been created to calculate distances between them. Most of the methods detailed in this tutorial are accompanied by examples of calculating the distances by hand to aid in comprehension.

## [Multiple Testing Correction](https://www.ahl27.com/OtherTutorials/articles/MultipleTesting.html)

Combining statistical tests isn't as simple as just averaging p-values--the more tests you run, the higher the chance of finding a spurious correlation due to chance. This tutorial covers common methods for correcting analyses for multiple testing under a variety of scenarios.