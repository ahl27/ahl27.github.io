---
permalink: /research/
title: "Aidan Lakshman"
excerpt: "Research"
author_profile: true
---

This page gives a brief overview of my research and other work projects.

## Doctoral Research

My doctoral research aims to develop comparative genomics methods to reveal functional associations among proteins. This takes the form of two primary Aims.

### Aim 1: Using Coevolutionary Signal to Find Functional Associations

Proteins often work with other proteins in a cell to achieve common function. Some notable examples of this are metabolic pathways or biosynthetic gene clusters. Over evolutionary timescales, this shared function results in a shared selective pressure on the genes responsible for these proteins. This work seeks to measure the extent of this shared selective pressure among genes to predict which protein-coding genes work in concert to achieve some shared function within a cell. This allows for quantification of functional relationships among proteins without reliance on wet lab investigation or prior knowledge. My algorithm outperforms the STRING database at recapitulating KEGG while using only sequencing data.

This algorithm is called EvoWeaver, and is distributed in the SynExtend package for R. This work was published in *Nature Communications*, and is available at [https://doi.org/10.1038/s41467-025-59175-6](https://doi.org/10.1038/s41467-025-59175-6).


### Aim 2: Scalable Orthology Detection

Comparative genomics relies on the identification of orthologs, genes deriving from a common ancestor. Since orthologs once were the same gene, we can hypothesize that they are likely to maintain a somewhat equivalent function in the present day despite occuring in different organisms. This allows for transfer of functional annotations and phylogenetic inference. Orthology detection typically has three steps: quantification of pairwise similarity between genes, clustering the resulting sequence similarity network to identify orthology groups, and then dealing with paralogous genes. My work seeks to improve on the second step in this process. Few benchmarks exist for the relative performance of network community detection methods applied to sequence similarity networks, and none are capable of keeping pace with the deluge of modern genomics data.

My algorithm, ExoLabel, leverages disk storage to identify communities on arbitrarily sized networks in linear time with low RAM requirements. Estimated computational requirements for a graph with 10 billion edges on a single-threaded machine is roughly 60GB of RAM, with completion in a few hours. ExoLabel is available in the SynExtend package for R, and an in-depth discussion of some of the work that went into it is available on my [blog](https://www.ahl27.com/posts/2025/04/exolabel-full/). A manuscript for this work is in progress, and will be submitted for publication in February 2025.


## Other Current Work

### Biostrings

I received an award from the [R Infrastructure Steering Committee](https://www.r-consortium.org/all-projects/call-for-proposals) to make critical enhancements to the [Biostrings](https://bioconductor.org/packages/release/bioc/html/Biostrings.html) package for R. This work will culminate in me taking over as the lead maintainer for the Biostrings package. This grant proposal was funded on April 26, 2024, and the work will take place from June 2024 - May 2025. For more details, check out the [grant proposal](https://www.ahl27.com/biostrings-isc-proposal-2024/).
