---
title: "The ExoLabel Post: Clustering Massive Networks with Limited Resources"
date: 2025-04-11
permalink: /posts/2025/04/exolabel-full/
tags:
  - blog posts
  - C
  - R
---

I've made a lot of posts about ExoLabel, but the project has been moving so quickly that they've become out of date almost as soon as I post them. I'm finally close to the end of this project, so I thought it was high time I write out the entire project (partly for my own reference, so I don't forget).

## The Problem

ExoLabel is a function to cluster big networks, but...why would anyone want to do that?

There's a lot of use-cases for network clustering (also sometimes referred to as community detection for graphs/networks), but our specific need came from a a problem we encountered in our workflow.

You may be shocked to learn that the field of comparative genomics revolves around being able to compare genomic data. This assumes we have an answer to a critical foundational question: how do we know what genomic data are comparable? Typically, genomic analyses are performed on "related" genes. For phylogenetic reconstruction, this would be groups of genes we assume derived from a common ancestor. The notion of genes being related is a little tricky to define, but a lot of it stems from genes that have similarity in their sequence.

We can get a measure of how similar sequences are by using tools for pairwise sequence similarity comparisons, like BLAST or DIAMOND. This gets us part of the way to a solution, but natural evolutionary processes introduce a lot of noise into the data we analyze. This means that truly related genes could appear to have low similarity, and unrelated genes could spuriously appear to be very similar.

One approach to get around this is to cluster the network formed by these genes when we connected them by their sequence similarity. In other words, we build a *sequence similarity network*, which is a graph where each node is a gene sequence, and each edge is the sequence similarity of the genes it connects. Clusters from these networks are typically a good estimate to get groups of genes we can analyze with other methods. With sufficient data, the true signal becomes distinguishable from background noise.

The problem we encountered is that we didn't have enough resources to actually find clusters in these networks. We get better results with more data, but the size of sequence similarity networks scales quickly as we add more data. The average *E. coli* genome has around 4,200 genes. If we sequence 1,000 of these genomes, that's 4,200,000 genes. We typically use reciprocal best-BLAST hits, so each gene will only have a similarity to one gene per other genome, but even with that, we're looking at around 2.1 billion edges.

Let's think about that in terms of computational requirements. Each edge is undirected, so it needs at least two IDs corresponding to the nodes it connects. They're also weighted, so they need a representation of the weight of the edge. 4.2M is just barely small enough to fit into an unsigned 32-bit integer, but if we grew at all it would be insufficient. That means we'll need two 64-bit integers (16 bytes) and one float (4 bytes) per edge. 20B per edge with 2.1 billion edges is 40GB of space. Now note here that this is just to store the network, and doesn't include any additional processing overhead (e.g., clustering, or even how to get node labels into nicely indexed 64-bit integers).

A thousand genomes isn't even that large -- our current analysis is looking 4,422 complete genomes from RefSeq, which comprises around 12 million nodes and 20 billion edges. Storing that in the aforementioned format would take 400GB of RAM just for the network itself. Maybe we leverage some sparse encoding techniques to shave off one of the integers from the edge representation; even with that, we're still looking at 12 bytes per edge, and 240GB to hold the network.

This isn't our end goal. We're looking to scale way past 4,422 genomes, but the scaling of these networks is not sustainable with current hardware. Sure, there are systems that have terabytes of RAM, but note the scaling of memory requirements with input size. When we moved from 4M genes to 12M (roughly 3x more), the RAM requirement increased by 10x. By that logic, going to 36M genomes would take at least 4TB of RAM, and 108M genes would take at least 40TB. The actual scaling is nonlinear, so we'd probably require a lot more than 40TB of RAM.

This is where ExoLabel comes in. We can't simply keep buying bigger hardware to process networks of this size, at least in our current compute environment. Maybe Big Tech has the resources to keep pace with this, but few academic labs have access to machines with multiple terabytes of RAM. Could we cluster networks in a way that somehow uses less RAM?

## The Solution

There's a solution to this issue that's very simple in theory: why not just offload the data from RAM to other storage? Much like a SQL database, we could store all the graph information somewhere on disk and just query for what we need, when we need it. If the clustering algorithm we use only needs data on a single node and its neighbors, we could reduce our memory complexity from scaling with the number of edges to scaling with the maximum node degree (asymptotically equivalent to scaling with the number of nodes, but much better for sparse networks). The critical issue is that read/writes to disk are extremely slow compared to RAM, even with SSDs. Solving memory complexity at the cost of infinite runtime is by no means a solution, so I had to spend a lot of time optimizing our implementation to work nicely with disk drives.

I'll start with the core clustering algorithm. I expected this to be the hardest part of the project, but it ended up being much easier than the database construction portion. I chose [Fast Label Propagation](https://doi.org/10.1038/s41598-023-29610-z) for a couple reasons. First, it's a recently published algorithm, so I have relatively high confidence that it's competitive with prior approaches. Second, the core algorithm only needs information on a single node and its neighbors to cluster that node, which meets my algorithmic needs to leverage a database structure. Third, it's fast (it says so in the name!). Lastly, label propagation is a relatively well-studied and commonly used approach for clustering sequence similarity networks.

Label propagation is a pretty simple algorithm at its core. We start by setting each node to be in its own cluster. Then, for each node, we consider all the incoming edges to that node. Each incoming edge starts at a different node in some cluster. We add up the incoming weights for each of these clusters, and then assign the node to the highest weighted cluster. For instance, suppose we have a node `A` with three neighbors, `B,C,D`. Nodes `B,C` are in cluster 1 and node `D` is in cluster 2, and all the edges have weight 1.0. Then cluster 1 has a total incoming weight of 2, and cluster 2 has a total incoming weight of 1. We then assign `A` to cluster 1. In fast label propagation, we keep a queue of nodes we're going to process (initially containing all nodes). Whenever a node changes its cluster, we add all neighbors in different clusters to the queue (if they're not already in it). There's a few more optimizations I added to this algorithm, but I'll come back to those in the deep dive section.

Next, let's talk about the database construction. Since I'm using label propagation, I needed a way to quickly look up the incoming edges for any particular node. It's also important to be aware of the problem setting: most networks I'm going to process are going to be relatively sparse in general, so something like an adjacency matrix would be way overkill. I settled on using an adaptation of a compressed-sparse row (CSR) format for the database. A CSR-encoding stores the end vertices for each edge back to back, and then stores an index somewhere that determines where the edges for each node live (note that this can be swapped to store the start vertices for each edge, I'm just using this representation because it's most efficient for label propagation). It's more easily described with an example.

Suppose we have a network with four nodes, `A,B,C,D`, and the following connections: `A->B`, `B->C`, `C->D`, `D->A`, `A->C`, `B->D`. We start by counting the number of incoming connections for each node:
```
A: 1 (D->A)
B: 1 (A->B)
C: 2 (A->C, B->C)
D: 2 (B->D, C->D)
```

We then form an index using the cumulative counts of these node degrees, and then store the start nodes inline afterward:

```
1 1 2 2 -> 0 1 2 4 6 (add a 0 at the beginning)

CSR:
0 1 2 4 6
D A A B B C
```
Why do this? This actually gives us a fast way to look up incoming connections if we know how what order the vertices come in. Here we ordered our representation as `A,B,C,D`. Suppose we wanted to get the incoming edges for node `C`. We know that `C` is the 2nd node (if we're using 0-indexing), so we look at the 2nd and 3rd values of the index, which corresponds to `[2,4]`. This tells us that the edges at positions `[2,4)` (not including the end position) belong to node C. This is also the reason we had to add a 0 to the beginning of the index -- we need `n+1` indices to store `n` nodes, since each node `i` is defined by a range `[index[i], index[i+1])`.

```
0 1 [2 4] 6
D A [A B] B C

Node C has two connections (4-2=2)
They are from nodes B and A
```

This is a nice representation for a couple key reasons. First, it stores all the edges for a particular node in a contiguous block. Disk drives are most efficient at sequential reads, so this allows ExoLabel to read all the edges for a particular node sequentially rather than jumping around in the database. Second, it stores the minimum amount of data necessary for each edge -- since we know the destination node implicitly using the index, we only have to store the source node (for directed graphs -- for undirected graphs, we have to store each edge as two directed edges). For weighted graphs, we can either store the weights inline with the edges or in a second table with matched format.

That's the high-level view of ExoLabel. We first read the input data into a CSR format on disk, and then we use fast label propagation, querying the CSR table for relevant data when we process each node. The next section will detail all the nitty-gritty, so if you're not interested in that, feel free to stop reading here.

## Performance

Before digging into the details, I'll give a brief description of its performance. Note that this is a work in progress -- I'll update this section as I finish the rest of my benchmarks. Note that the RAM consumption doesn't include the amount of RAM required for R and the SynExtend package, which is around 300MB on my machine. These tests were performed on an M1 MacBook Pro with 16GB RAM and graphs stored on an internal SSD. All these test cases are real sequence similarity networks. The final test read the input file from an external HDD connected via USB-C, with intermediate files stored on the internal SSD. Edges are directed, so the number reported is twice the number of undirected edges.

| #Vertices | #Edges | Runtime (MM:SS) | RAM Consumption | Disk Consumption |
| -----: | -----: | :-----: | :-----: | :-----: |
| 56,266  | 686,286  | 00:02.0  | 113MB  | 22.0MB  |
| 128,008 | 1,503,044  | 00:02.1 | 132MB  | 50.7MB  |
| 1,375,735 | 156,434,932 | 01:43.7 | 271MB  | 5.0GB |
| 3,500,903 | 937,020,456 | 15:17.2 | 380MB | 29.9GB |

Accuracy benchmarks are forthcoming. Anecdotally, it produces pretty good results. For reference, [HipMCL](https://doi.org/10.1093/nar/gkx1313) required 240 cores and 15TB of unified RAM to process a similar sized network to ExoLabel's final trial (with roughly 3.5M nodes, 700M directed edges) in 30 min.

## Deep Dive: How does it *really* work?

Let's now go through how ExoLabel actually works in detail. There are 5 key steps:
1. Reindex the nodes
2. Record the edges (happens in parallel with (1))
3. Sort the edgelist file
4. Do the clustering
5. Write out the results

### Step 1: Reindexing

ExoLabel uses integer-indexed nodes, but the input data won't be formatted in that nice format. The output of BLAST searches is usually in plain text and stored like the following:

```
VERTEX1 VERTEX2 SIMILARITY
VERTEX1 VERTEX2 SIMILARITY
VERTEX1 VERTEX2 SIMILARITY
```

For example:
```
abc def 0.0451
abc ghi 0.8713
def ghi 0.2301
def xyz 0.5678
```

I don't want to use string-based indexing. Strings are messy -- they're slow to compare (relative to integers) and have highly variable space requirements. I'm working in C for this, so I don't have a simple string class. Each string could take any number of bytes, potentially even more than the 8-bytes per node required of integer indexing. Variable width fields also make it hard to read in edges from the CSR compression. With integer indexes, if I know that there are 10 edges starting from index 20, I can just move the file pointer to position 20 and read in 10\*8 bytes. With strings, I'd have to also store the number of bytes to read and the lengths of each string in the field.

In order to transform the string input to integers, I'm using a [trie](https://en.wikipedia.org/wiki/Trie). Tries are not the most efficient way to map strings to integers; we could theoretically just hash the string. However, we have to be able to write out the clusters at the end of the function. Users aren't going to want random indexes, they're going to want the labels they provided. This means I have to store all the vertex names *somewhere* on the computer. It's technically possible to store them on disk, but this ends up getting extremely complicated (mainly because of variable length fields, again). I settled on an in-memory trie because it has fast access and the space complexity is very good for solutions that store the entire string.

The trie structure has two types of components: internal nodes and leaf nodes.

First, the leaf nodes:
```c
typedef struct leaf {
  uint64_t count; // also tracks the cluster number
  uint64_t index;
  uint64_t edge_start; // start position of edges in the disk file
  uint32_t dist; // distance to original label, used for attentuation
} leaf;
```

The leaf nodes have a number of attributes. `index` is the most important one here; it stores the index of a given string in a 64-bit unsigned integer. As I read in each node, I try to insert it into the tree. If it doesn't exist, we insert it and assign it to the next available index.

The other attributes are for later clustering steps. `count` stores the in-degree of each node, which we need for the CSR compression later. During the clustering step, it stores the cluster the node is currently assigned to. This makes some of the variable names a little confusing, but is worth it because it saves a lot of memory. `edge_start` stores the offsets for the CSR compression. In a typicaly CSR format, this is stored in the file itself, but moving it into memory saves a lot of runtime by reducing how much we have to jump around in the file. The cost is 8 bytes per node, which isn't a ton (100M nodes would only be 800MB). `dist` is for attenuation, which I'll talk about in Step 3.

I'm planning to eventually combine the `index` and `edge_start` variables, since they're never used at the same time...I just haven't gotten to it yet.


Next, the internal node:

```c
typedef struct prefix {
  uint64_t bmap1 : 56; // 0, 32-86
  uint8_t count1 : 8;  // counts in this bitmap
  uint64_t bmap2 : 42; // 87-127
  uint8_t count2 : 8;   // counts in this bitmap
  void **child_nodes;  // 0 will be leaf, else will be prefix
} prefix;
```

This structure is designed to be as light on memory as possible. There are 128  ASCII codes, of which only the values 32-126 are printable (I also included 127 by accident...it's not needed though, and it doesn't hurt). Internal nodes have a total of 3 elements: a 98-bit bitmap, a count of how many values are in the tree, and a pointer to an array of pointers. Let's suppose I only supported the numbers 0-7, and wanted to insert one of them into a leaf:

```
leaf structure:
  bitmap: 0000 0000
  count: 0
  children: []

>> insert 6 <<
bitmap = bitmap OR 6
count++
children.append(child6)

leaf structure:
  bitmap: 0000 0100
  count: 1
  children: [child6]
```

To find children, we shift through the valid bits of the bitmap to figure out which character the next child in `children` corresponds to. In this case, `children[0]` is a child node corresponding to the current prefix plus the number 6. This allows each prefix to store *up to* 98 children, but without requiring that we allocate 98 pointers at each node on initialization. It's basically a sparse format. The reason there are two bitfields is because there are 98 characters, so a single 64-bit integer wasn't large enough (and 128-bit integers aren't portable).

This takes care of when prefixes, but what if the current node is the end of a string? If we knew that every child was another internal node, we could make `children` of type `struct prefix**`. However, sometimes we have a child that is of type `struct leaf`. These are always stored at the first bit, so if `prefix.bmap1 & 1 == 1`, then the first entry in `children` is a pointer to a `struct leaf` object. The first bit is used because it corresponds to an ASCII code of 0, which is the null-terminator for strings. All other entries in `children` are `struct prefix` pointers. The `count` variables allow for a little bit of optimization so I don't have to exhaustively check every bit every time.

The first step passes through the input edgelist files. The separator between entries is provided as a parameter and typically set to `\t` (as in a `.tsv`). The algorithm reads characters into a buffer and looks for the separator. When the separator is encountered, it *tries* (lol) to insert the prefix into the trie. If it exists already, we increment the `count` value of the leaf. If it doesn't, we make a new leaf and set its `count` value to 1. If we're reading in undirected edges, we only increment `count` if the node is the destination node for the edge.

### Step 2: Recording edges

In an earlier implementation of ExoLabel, this step happened after step 1. However, due to some other optimizations, it now happens in parallel.

In step 1, ExoLabel indexes all the nodes and records the in-degree of each node. At the same time, we write all the edges that will eventually become the CSR-format to a file. This step won't make any sense without a brief description of what's coming, so let's briefly take a detour to talk about step 3.

Recall that we're trying to build a CSR-representation of the network. In order to do that, we have to have all the source nodes for each edge ending at each node in contiguous blocks in the file. At first, I did this by recording the in-degree of each node in the first pass through the file, then recording the values at the correct position during a second pass. This makes a lot of sense if you're operating in-memory, but it is a terrible decision when working with disk drives. Because of how spinning-disk drives operate, moving to a random position on a file that lives on a drive is closer to a linear worst-case time complexity, rather than the constant time complexity you'd expect in RAM. SSDs are a lot better at this, but even they struggle with random read/writes due to caching and prefetching.

The right approach is to play to the strengths of physical disk drives: sequential read/writes. Pretty much everything comes back to minimizing number of reads/writes, and making the ones you have to do sequential. Think back to the CSR compression. We have to have each node's edges be contiguous, and every node is indexed by an integer. The key idea here is that if we record each edge as `[end, start]` and then sort them by their first entry, the resulting edges will be grouped in CSR format. For example, with the case from earlier:

```
Input network:
A->B, B->C, C->D, D->A, A->C, B->D

Sort edges by destination node:
D->A, A->B, A->C, B->C, B->D, C->D

Discard destination node:
D A A B B C
```

This gets us a CSR format graph, assuming we have the index stored somewhere else. Since the in-degree for each node is stored in the trie as they're read, it's easy to construct an index after all edges are recorded.

Sorting the list of edges is a good idea because we can do it entirely with sequential read/writes using merge sort. While this has `n*log n` complexity (`n` the number of edges), it ends up being significantly faster than the naive approach because sequential read/write is constant time complexity, whereas random read/write is linear (making the naive approach closer to `n^2` scaling).

As we traverse the file in Step 1, we also record the edges. Since step 3 involves merge sort, I frontload part of the operation by sorting fixed size buffers prior to writing. Practically, this means that ExoLabel reads in around 40,000 edges at a time, converts strings to indexes as they're read in, sorts the list of ~40k edges, then writes those to the file and clears the buffer. These writes are all sequential and at the end of the file, so they're extremely fast. This pre-sort step saves a lot of time later -- it technically adds linear time complexity since each sort is on a constant-size array, and merge sort is most time-consuming at the early stages when its merging small blocks (especially when those blocks are on disk and not in RAM). It's important to note that the buffer used to hold edges is global; when reading in multiple input files, the ends of files may not match up perfectly with buffer sizes. In tihs case, the next file should continue writing edges to the buffer prior to sorting and flushing the buffer so that all blocks in the resulting file are the same size (except potentially the very last block).

The catch is that this approach requires that both vertices be recorded. One of the big advantages of CSR compression is only one of the nodes has to be saved. We also need to record the weight (4 bytes if using `float`), for a total of 12 bytes. Recording both vertices theoretically causes the overall disk space requirements to increase to 20 bytes per edge. Optimal merge sort requires a second copy of the file as well, so we're up to 40 bytes per edge. Not great.

I solved this by compressing each edge into a smaller format. Rather than recording each edge as `end, start, weight`, I'm using two 64-bit integers `end, comp`. Here, `comp` is a combination of the start node and the weight.

This compression happens as the nodes are read in. For each index, the first 44 bits are reserved for the index of the source node. This reduces the total number of nodes we can process, but 2^44 is over 17 trillion, which should be more than enough nodes. When compressing the weight, I left shift it until the topmost bit is 1 or I've made 15 shifts (the max amount that fits into 4 bits). The number of shifts is stored in the next 4 bits. Finally, the transformed weight is truncated to the topmost 16 bits, which are stored at the final 16 bits. It's essentially a modified 16-bit floating point number that doesn't allow negative values or exponents.

Using this compression, each edge occupies 16 bytes. Factoring in the merge sort, the maximal bytes per edge is 32 bytes. This is an extra 20 bytes per edge over the original implementation that didn't use sorting, but it requires one fewer pass through the edgelist files and writes to disk an order of magnitude faster. Although I'd love to have less disk consumption, the practical consumption is around the same size as the input edgefiles in most tests, so it's not a huge deal. I would be more concerned if there were orders of magnitude more disk consumption than the input file size. Worst case, I can add a flag to delete input files as they're read in (and potentially rewrite it at the end), which would drastically reduce overhead at the cost of modifying input data.

There is also slight loss of precision, but it's on the order of 0.01% or less for nearly all input values. The highest loss of precision by percentage is at extremely small weights, where the loss in precision isn't super meaningful. The absolute error scales with the magnitude of the weights, but again this isn't a huge cause for concern. For weights of around 60k, the error is around 10. If clustering is dependent on extremely small variations in weights then this may not be a good approach, but I imagine these scenarios to be very limited. The number of bits allocated for weights can also be adjusted to get more precision, though each additional bit for weights or exponents halves the maximum number of nodes supported.

### Step 3: Sorting

I already mentioned that the next step is sorting the edges in the file. I'm using an external merge sort for this operation. I've actually already written a very in-depth explanation of what's going on here, so I'll just link to my previous [blog post on loser trees](/posts/2024/12/loser-trees-io/). In short, I use a tournament tree (also known as a loser tree) to perform a multi-way merge sort on the file. Classical merge sort is a 2-way merge because it merges two blocks at a time. This implementation uses up to a 64-way merge depending on how many blocks are present in the file. Merging more blocks at a time has no impact on the asymptotic runtime scaling of the operation, it just reduces the number of iterations required at the cost of making the merge step take longer. This is important for files because the slowest operation is reading from disk (even if it's sequential), so there's a large performance improvement to merging more blocks at a time since merging happens in RAM, whereas each iteration requires a full pass through the file.

At the end of the sorting step, I have a sorted file containing compressed edges. I then iterate through this file, overwriting the file from the front with just the second entry of each edge (i.e., the compressed `source/weight` value). I truncate the file, then iterate over it a second time to split each compressed edge into a decompressed source node index and weight. The index overwrites the current file, and the weight is written to a second file. The file of indexes is the neighbors table, and the file of weights is the weights table.

I do this in two passes to reduce the total disk consumption -- by first discarding the end node index, I reduce the size of the file by half. The next step of decompressing the edges increases the size of the file by 50%, which makes the overall maximal disk consumption less than that of the merge sort. We'd technically have less disk consumption than the merge sort step even if we decompressed first, but I also have an in-place merge sort implemented, and this would be 50% more consumption than the in-place version. Doing it this way is consistent across both methods and ensures the same maximal consumption.

### Step 4: Clustering

I've already somewhat described the clustering step, but there are a few more aspects to it that I skimmed over.

First, let's review the core algorithm. I initialize a queue of nodes to process. For each node, we get the start and end index for its edges in the CSR database. Those edges are read in (from both the neighbors table and the weights table), and then the cluster with the highest weight is assigned to the current node. Each neighbor in a different cluster to the one I just assigned is added to the queue (if it wasn't in the queue already). The clusters are stored in the `count` attribute of each leaf nodes.

The start indexes and clusters are stored in the leaf nodes of the trie, so how do we get to them quickly? Prior to clustering, I traverse the trie to build an array of pointers to each leaf node. This array is constructed such that `array[i]` is the leaf node corresponding to node `i`. Thus, `array[i+1]->edge_start - array[i]->edge_start` is the number of edges for node `i`.

Label propagation has pretty good practical runtime, but can theoretically run forever. We stop once there are no more nodes in the queue, but cycles can appear that never terminate. To solve this, ExoLabel keeps count of how many times it's seen each node. Once it's seen a given node more than a predetermined amount of time (by default, the square root of the maximum node degree), it will no longer add the node to the queue. This prevents the algorithm from running forever.

I also mentioned that there's a distance attribute in the leaf nodes. This is to solve the monster group problem that plagues label propagation algorithms. Label propagation is susceptible to grouping all nodes into a giant cluster, which isn't super informative. I use dynamically-scaling label hop attenuation (as introduced by [Leung et al., 2009](https://doi.org/10.1103/PhysRevE.79.066107)), which reduces the contribution of a cluster the farther it's traveled from its original point. The amount that the weights are attenuated scales based on the proportion of nodes that changed label in the previous iteration. The distance attribute in the leaf nodes stores the minimum distance to the origin of the current cluster.

### Step 5: Output

At this stage, each node's final cluster is stored in the `count` attribute of the corresponding leaf node in the trie. Additionally, each label is stored along the paths of the trie. This means that the labels and their corresponding clusters can be recovered with a simple depth-first traversal of the trie structure. The labels are cached along each node as the trie is traversed. When a leaf node is encountered, the current label and the cluster are written to the outfile.


## Conclusion

I think this is one of my longest blog posts, ever. If you've made it this far, thanks for reading. Check out the code for ExoLabel in the SynExtend package on [GitHub](https://github.com/ahl27/SynExtend), and stay tuned for a paper on it in the near future!