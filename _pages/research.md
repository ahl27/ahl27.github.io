---
permalink: /research/
title: "Aidan Lakshman"
excerpt: "Research"
author_profile: true
---

This page gives a brief overview of my research and timelines.

## Doctoral Research

My doctoral research aims to develop comparative genomics methods to reveal functional associations among proteins. This takes the form of three Aims.

### Aim 1: Using Coevolutionary Signal to Find Functional Associations

Proteins often work with other proteins in a cell to achieve common function. Some notable examples of this are metabolic pathways or biosynthetic gene clusters. Over evolutionary timescales, this shared function results in a shared selective pressure on the genes responsible for these proteins. This work seeks to measure the extent of this shared selective pressure among genes to predict which protein-coding genes work in concert to achieve some shared function within a cell. This allows for quantification of functional relationships among proteins without reliance on wet lab investigation or prior knowledge. My algorithm outperforms the STRING database at recapitulating KEGG while using only sequencing data.

This algorithm is called EvoWeaver, and is distributed in the SynExtend package for R. A manuscript for this research is currently in revision at *Nature Biotechnology*. A preprint is not publicly available, but can be viewed [here](../files/EvoWeaver.pdf).


### Aim 2: Scalable Orthology Detection

Comparative genomics relies on the identification of orthologs, genes deriving from a common ancestor. Since orthologs once were the same gene, we can hypothesize that they are likely to maintain a somewhat equivalent function in the present day despite occuring in different organisms. This allows for transfer of functional annotations and phylogenetic inference. Orthology detection typically has three steps: quantification of pairwise similarity between genes, clustering the resulting sequence similarity network to identify orthology groups, and then dealing with paralogous genes. My work seeks to improve on the second step in this process. Few benchmarks exist for the relative performance of network community detection methods applied to sequence similarity networks, and none are capable of keeping pace with the deluge of modern genomics data.

My algorithm, ExoLabel, leverages disk storage to identify communities on arbitrarily sized networks in linear time with constant space RAM. ExoLabel can process networks with billions of nodes in under an hour using only 100MB of RAM, and is available in the SynExtend packcage for R. A manuscript for this work is in progress, and will be submitted for publication in October 2024.


### Aim 3: Scalable Identification of Functional Pathways

Aim 1 identifies functional associations among pairs of protein-coding genes. This Aim will identify complete functional pathways by clustering the network derived from pairwise functional associations elucidated in Aim 1. In theory, this should serve as a powerful hypothesis-generating tool to guide future wet lab investigations, such as for identifying potential new biosynthetic gene clusters or functional pathways in understudied organisms.

I plan to use the results of this Aim alongside my previous research and other efforts in our lab to release a novel database to quantify coevolutionary relationships among gene families across the tree of life. This work has not yet started, but is planned to take place from October 2024 to May 2025.

## Other Current Work

### Biostrings

I received an award from the [R Infrastructure Steering Committee](https://www.r-consortium.org/all-projects/call-for-proposals) to make critical enhancements to the [Biostrings](https://bioconductor.org/packages/release/bioc/html/Biostrings.html) package for R. This work will culminate in me taking over as the lead maintainer for the Biostrings package. This grant proposal was funded on April 26, 2024, and the work will take place from June 2024 - May 2025. For more details, check out the [grant proposal](https://www.ahl27.com/biostrings-isc-proposal-2024/).