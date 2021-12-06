---
permalink: /projects
title: "Personal Projects"
excerpt: "Personal Projects"
author_profile: false
redirect_from: 
  - /projects/
  - /projects.html
---

# Software

### Academic Paper Finder 
I wrote [this script](https://github.com/ahl27/findPapers) to discover more papers similar to what I'm currently reading. It takes as input a collection of PubMed ID's and search terms, and then traverses the network of citations to find more papers containing the search query. It then uses TF-IDF to convert each paper's abstract into a vector, and then clusters the result with K-means clustering. I wanted this to run on my iPad, so I used Pythonista, which unfortunately does not have access to most widely used libraries for NLP (such as pandas or scikit-learn). As a result, everything is implemented from scratch, including TF-IDF and K-means. 

In the future I'm going to investigate hierarchical clustering methods (ex. UPGMA), using SciBERT for clustering, and having the script search for terms for you (removing the need for initial PubMed IDs to search from).

### Whitespace Interpreter
I'm a big fan of esoteric languages, and one that really caught my eye was [Whitespace](https://en.wikipedia.org/wiki/Whitespace_(programming_language), a Turing-complete programming language using only whitespace characters (space, tab, and return). I wrote up [this interpreter](https://github.com/ahl27/whitespacehttps://github.com/ahl27/whitespace) in Python for running Whitespace code, mainly as an exercise for learning how interpreters work. One of the big challenges was that popular text editor programs automatically reformat whitespace characters (ex. tabs to spaces), which immediately ruins Whitespace programs.

# Hardware

### 6502 Breadboard Computer

I built this computer following [Ben Eater's](https://eater.net/) guides on YouTube. It's a breadboard computer using a 65c02 microprocessor, with 32KB of RAM and 16Kb of ROM. Ben Eater initially connected a keyboard via PS/2, but I wanted my computer to be able to communicate with USB protocols. I used a Raspberry Pico to build a USB-to-PS/2 decoder that translates USB Keyboard input into serial PS/2 codes.

### Keyboard

I love building mechanical keyboards (and honestly I have too many at this point). My favorite at the moment is this Helidox Corne, a split layout ortholinear keyboard with 42 keys. I'm currently using ZDA keycaps with Gateron Black switches (although pictured are a set of colorful DSA keycaps that look much prettier).

### Web Server

I built a web server to centralize my files, gain some experience with LAMP stacks, and have a robust compute environment that I could access remotely from something like an iPad. My web server hosts NextCloud to store my files on, and runs RStudio Server edition on a virtual machine. I'm interested in adding on a small supercomputer cluster with something like Kubernetes on Raspberry Pis for prototyping. Just waiting on computer parts to become more available before I keep working on this.
