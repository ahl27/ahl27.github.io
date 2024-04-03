---
title: "Clustering without RAM"
date: 2024-03-01
permalink: /posts/2024/03/oomcluster/
tags:
  - blog posts
  - C
---

My next research project involves determining groups of genes that derive from a common ancestor (usually called 'orthologs'). To do this, we often take a bunch of gene sequences, quantify their pairwise similarity in some fashion, and then cluster them into groups of genes that are more similar to each other than to other clusters. I'm oversimplifying a lot here to keep this brief, so keep in mind that the actual calculations of those "pairwise distances" can involve a bunch of stuff.

However, the main part of the problem I'm looking at is the next step of the equation. Given that we have a ton of things with pairwise similarities among them, how can we best cluster them? If you're a mathematician or a computer scientist, the phrases "A ton of things" and "pairwise similarities" should immediately call to mind a graph structure. Graphs are everywhere, and this is no exception. Fortunately for me, graph clustering methods are an extremely well studied problem. The typical name for these methods is "community detection algorithms", since they try to identify communities in a network. Think of something like a social network, in which the clusters/communities we identify are communities of people that interact with each other.

Now, the problem with genetic data is that it's huge. The UniProt database has [over 250 million sequenced proteins](https://www.uniprot.org/uniprotkb/statistics) (as of this time of this post), and that number is only growing. While many algorithms exist for community detection, lots of them have quadratic scaling. Ideally, we'd have some linear time algorithm that can cluster massive datasets like this, even if it's just a first-pass cluster that we refine later.

## Linear-time clustering: Label Propagation

Linear-time algorithms do in fact exist, and the one I settled on is called Label Propagation. Label propagation has a few nice properties: it takes linear time and memory, it works on weighted graphs, and it's super simple. The basic algorithm looks like this:

```
initialize each node to its own community
while node_has_been_changed:
  for node in graph:
    sum all outgoing weights by community
    reassign node to community with most weight
```

We go through all the nodes, and update each node to whichever community is most represented from its neighbors. Pretty simple.

Unfortunately, this implementation is pretty efficient. Any time a node is changed, we reevaluate all nodes in the graph. This could end up approximating quadratic runtime if we have particularly bad graphs (the observed time complexity is around `O(m^1.23)`, `m` the number of edges). [Subsequent work](https://www.nature.com/articles/s41598-023-29610-z) introduced the Fast Label Propagation (FLP) algorithm, which instead uses a queue structure to keep track of nodes that have changed. This modifies the rough structure of the algorithm to the following:
```
q <- queue(all_nodes)
initialize each node to its own community
while length(q) > 0:
  node <- dequeue(q)
  sum all outgoing weights by community
  reassign node to community with most weight
  for(neighbor in neighbors(node))
    if(cluster(neighbor) != cluster(node) && !(neighbor in queue))
      enqueue(q, neighbor)
```

This ends up being much faster, and actually shows better performance at community detection compared to the classic label propagation algorithm. You can check out the previously linked paper for more details, but the worst-case runtime complexity on average graphs tends to be around `O(m+(1/n-2))`, where `m` the number of edges and `n-1` the average node degree. Other runtime statistics are derived, but suffice it to say the average runtime is approximately linear in the number of nodes rather than scaling superlinearly.

## Big Data Problems

Identifying and implementing the algorithm isn't actually the tough part. If you're interested in an FLP algorithm, you can check out either the `igraph` implementation (available on [this GitHub branch](https://github.com/vtraag/igraph/tree/flpa)) or my own R-compatible implementation (available on [my GitHub repo](https://github.com/ahl27/machineRy)). My own testing on weighted graphs with power-law distributed node degree has shown FLP to outperform standard label propagation on all the graphs I tested.

The bigger issue here is that huge graphs require huge amounts of memory. While this algorithm works, it's not trivial to analyze a graph with hundreds of millions (or even billions!) of nodes. If you consider each edge to have an integer start and end and a `double` weight, a graph with two hundred million nodes and average node degree of 4 would require 1.28GB of space (two 32-bit `int`s for node indices, one 64-bit `double` for weight = 16B per edge, 16\*4\*200mil = 1.28bil = 1.28GB). That's just space for the edges--we'd need additional space to store all the names of the nodes, and even more to run the algorithm itself. Asking a computer for a gigabyte of contiguous memory is typically not the best strategy, and unfortunately these issues will only get worse as graphs get larger. 32-bit ints can only support numbers up to around 4 billion, so past that we'd double in space from using 64-bit ints.

We can always say "just get a super computer!". However, not everyone has access to enormous amounts of RAM. Memory prices in general have been fairly stagnant recently, and expecting users to be able to huge amounts of RAM to a single analysis isn't super feasible.

No one said we have to use RAM, though. Large database management systems don't load their entire systems into RAM, they leverage disk space to keep most of the files and copy things into RAM as needed. With FLP, we really only need to know the edges connected to a single node at a time, not the entire graph. The focus of this algorithm is developing an FLP implementation that doesn't rely on lots of RAM usage.

## Pitfalls and Implementation

The trouble I always have with big data algorithms is the number of issues you encounter that are just totally insignificant when not at scale. Ideally, all of our nodes will be numbered `1-n` so that we don't have to deal with variable-length names like strings. Think about this implementation--what issues are we going to have to handle? Here's a list of problems I had to solve in the final implementation:

- How do we convert node names to indices? We have to iterate over the nodes and number them, but how?
- Where do we store all the node names? (Eventually we have to convert back from indices to names)
- How do we store the graph itself?
- How do we iterate over the graph's nodes?

Most of these issues aren't even related to the core part of the algorithm, they're just data handling.

Reindexing the nodes is one of the problems that seemed so simple but turned out to be relatively challenging. At small scales this is fairly trivial--just insert them into your favorite variety of hashmap/set/list/whatever, discarding copies. However, this means that we'd have to keep all the string names in memory. Again, if we have a hundred million nodes labeled with strings that average around 8 characters, thats 800MB just for the that set. Prefix trees like a Trie could work, but they're still going to have large memory consumption.

The solution I landed on looks like this:

```
dir = temporary_directory()
set_working_directory(dir)
ctr = 0
for (node_name in edges)
  hash = hash_string(node_name)
  if(!file.exists(hash))
    file.create(hash)
  hashfile = file.open(hash)
  for(line in hashfile)
    if(node_name in line)
      goto_next_node_name()

    file.append(node_name, ctr)
    ctr += 1
```

Depending on how many bits our hash function is, we can generate more shallower files or fewer deeper files. This solution lets us record a bunch of files in `name index` format while only requiring us to store the value `ctr` across the entire algorithm.

This lets us reindex the label names, but we still need to actually record the graph structure itself. I used a pretty standard representation for this called [Compressed Sparse Row](https://www.usenix.org/system/files/login/articles/login_winter20_16_kelly.pdf) (CSR) format. Essentially, each edge is stored as its end point and a weight back-to-back in the file. For 64bit indices and `double` weights, that's 16 bytes per edge. The first `n+1` values store offsets that indicate where each node's edges reside. Each of these values are also 64bit `int` values, so eight bytes. For example, if the third value is 44 and the fourth value is 55, this means that edges originating from the node with index 3 are edges 44-54.

The nice thing about this representation is it works really well with our hashing strategy for node names. As each node is added to the map, we check if it already exists. If it does, we increment the number of edges it has by one. Otherwise, we initialize its value to 1. This means that, once we've hashed all our node names, we'll also have a separate file that contains the degree of each node. By converting that to cumulative sums, we obtain the first `n+1` values for our CSR format. A second trip through the data allows us to populate the edges list with all the relevant edges. This lets us store the entire graph structure using a total of `8(v+1) + 16n` bytes, where `v` the number of vertices and `n` the number of edges. In the undirected case, we store each edge twice (the forward and reverse direction), so we'll need `8(v+1) + 32n` bytes. In terms of average node degree `d`, that's `(8+32d)(v) + 8` byte for undirected graphs. For our previous example of two hundred million nodes and average node degree of four, we'll need about 27GB total. That's a lot of memory, but it's not a ton of disk space.

The last dilemma is iterating over the nodes. Traditionally we'd just use a queue, but a linked list with two hundred million entries is...not the best. I instead used a pair of files stored on disk for each queue. For each iteration, we dequeue from our first file and enqueue to the second. At the end of the iteration, we swap which file we enqueue to and dequeue from. This ensures that we're always performing read/writes sequentially to optimize cache efficiency, and keeps our queue size small. We can also optimize our enqueue operation by keeping a third file with just a big bitfield, such that the n'th bit is 1 if that index is already in the queue, and 0 otherwise. At each node, we can easily look up its edges in the CSR file, determine what its new cluster should be, and then write it to the cluster file. Initializing the queue can be done randomly using the ["inside-out" Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_%22inside-out%22_algorithm).

## Code and Conclusions

All the code for this can be found on the [GitHub repo](https://github.com/ahl27/machineRy) for this project.
**This is not a finished build**. There's a lot I still need to optimize and refine; the goal was just to get a prototype working. The biggest things I need to change are switching to `mmap` from `fseek` strategies--`mmap` offers better performance for random read/write to a file, but unfortunately it's not cross-platform compatible. While there are workarounds, but I'd rather not put that burden on the user...better to just figure out how `MapViewOfFile` in `windows.h` works and use preprocessor directives to switch between depending on the platform.

Scalability is about what you'd expect from the theoretical analysis. In some preliminary testing, my implementation scales linearly with respect to the number of nodes and number of edges. Performance is basically identical to my in-memory FLP implementation. Memory overhead is extremely low, but the cost for that is that we rely heavily on read/writes to disk, so runtime is pretty slow. My SSD-based machine could do an undirected graph with 10,000 nodes and 100,000 edges in 0.04s in-memory and just short of 70s out-of-memory. There's definitely room for improvement! Most of the runtime is in the initial pass of reading in and indexing the nodes--the clustering itself goes very fast. Some anecdotal evidence: on an undirected graph of 2,000 nodes and 20,000 edges, reading in the nodes took 2x as long as reading in all the edges, and the clustering took less than a fifth of the time of both node and edge reading combined. I'll probably optimize this later by changing the data structure used to store the node labels (like a trie or something). 

Anyway, thanks for reading.
