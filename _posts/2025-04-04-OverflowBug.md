---
title: "A Story of a Sneaky Bug"
date: 2025-04-04
permalink: /posts/2025/04/overflow-bug/
tags:
  - blog posts
  - C
---

I solved a really tricky bug in [ExoLabel](/posts/2024/03/oomcluster/) recently and thought it would be an interesting experience to share.

## Context: Monster Groups

At this point, I've been working on ExoLabel for a while. I have a working clustering algorithm that performs fast label propagation on graphs of arbitrary size. Throughout development, I've been fighting this phenomenon I like to think of as the "monster group effect". Traditional label propagation is very susceptible to agglomerating all nodes into one giant cluster, similar to what you'd get out of single-linkage clustering. This is a well-known drawback of label propagation (and graph clustering algorithms in general), and there are a lot of proposed solutions that have varying effectiveness.

The issue is that not every solution scales well as graphs get larger. To showcase this, let's look at a common approach: adding self-loops. Self-loops essentially add "inertia" to each node, making it resist changes from incoming edges. However, the number of edges in a network typically scales quadratically with the number of nodes. If we assume that spurious edges occur with any probability, the weight of spuriously connected communities will also scale quadratically with the network size. Self-loops are constant, so eventually they'll be outscaled by larger and larger networks.

I implemented two measures to combat the monster group problem. First, I use a self-loop cutoff rather than a fixed self-loop. This means that, in order for a node to be assigned to a neighboring community, at least one of the edges carrying that community must have a weight past the self-loop cutoff. This ensures that there is at least one non-spurious edge before propagating a label.

Second, I use label-hop attenuation. This is a technique I found in a previous paper on label propagation variants (see [Garza and Schaeffer, 2019](https://doi.org/10.1016/j.physa.2019.122058)). In label propagation, we begin by initializing each node to its own cluster. With label-hop attenuation, we track how far each label is from the original node it started with. These distances are initialized to zero, and when a node is assigned to a new cluster, its distance becomes one more than the minimum distance from that cluster. This distance is used to attenuate the edge weights to decrease the influence of edges the farther they've spread from the initial node. There's a lot more details on how that works, but they're not really relevant to this story -- essentially the farther you get from the source, the less your influence, and we track that distance in terms of number of steps it takes to travel back to the source.

## The Problem

My development process followed a maddening cycle:

1. I'd validate that everything is working correctly
2. I'd ensure that my results matched previous examples of correct performance
3. I'd check that it works on slightly larger graphs (it would)
4. I'd happily determine that I've finished
5. I'd test on much larger graphs, and it fails

The issue is that a lot of the errors only revealed themselves at sufficiently sized networks. Testing on networks with 1,000 nodes worked fine, but then I'd get monster groups again on networks with 100,000 nodes. I'd fix those issues and it would work again, only to return a monster group for networks with 1,000,000 nodes.

After a lot of debugging, I finally got it to work with the largest subset of my complete testing data that I could handle on my computer in reasonable time (around 3.5 million nodes and 500 million edges). I figured that I had finally finished catching all the little bugs, and we applied it to the complete network I've been building towards during this whole process (around 16 million nodes and 40 billion edges).

And.....it failed.

Once again, I was seeing a lot of nodes clumped into one giant monster group. By "a lot", I mean over 15 million of the 16 million total nodes. Way, way too more than should belong to a single cluster for this input data.

This set off some alarm bells in my head. First, I've gone through this process a bunch of times, and I'd like to think that there are less and less chances of having *another* conceptual issue that only affects cases where I have 10x more nodes than my last test case. Most of these issues were major conceptual problems, like when I realized self-loops fail to scale and moved to self-loop filters. Surely this can't keep happening forever, right?

The other weird thing is that this wasn't *that* much larger than the previous test case. In other times doing debugging like this, I had issues with graphs 10x larger than then previous one. I did some additional checking and validated that it worked fine for a network with five million nodes, which is only 3x less than the network that failed. This also seems to suggest that there isn't a major conceptual issue, more likely a small bug.

## So, where is the problem?

The next step was to figure out where the issue is. I've said it before, but I have been through this code many times with a fine-toothed comb. At this point I'm not sure what to look at that I haven't already checked.

I started by going through what I knew about the problem. I know it appears on my full dataset, but not on some of the smaller subsets I can constructed for testing. The full dataset is around 3-5x larger than the largest subset, and significantly more connected (i.e., it has fewer disjoint communities).

Now, I'd love to take the time and walk through all the things I thought of and looked at, but unfortunately they won't make a ton of sense without a deep knowledge of the codebase. If you really want to try for yourself, I'll leave a permalink to the commit right before I fixed the bug here: [commit 6c5cf30](https://github.com/ahl27/SynExtend/tree/6c5cf30533e8abc2e962b597827826e1aa663b64) (may not be stable if you're reading this years in the future).

Instead, I'll just cut to the chase. Remember how I'm storing the distances for label-hop attenuation? Previously, I was using `uint16_t` to store this distance. The rationale for this decision is essentially that once we get to 65,535 steps away from the soruce, we can just stop incrementing and assume the weight is going to be really small. A minimum distance of 65,535 in a network structure is *really* far, even arbitrary people on social media are typically connected by something like 4-5 hops.

In code, I'd do this by only incrementing if the value isn't about to overflow. My previous code looked like this:

```c
void update_node_cluster(...){
  /*
   * lots of preprocessing stuff and other code ...
   */

  // max_clust is the highest weight cluster neighboring the current node
  if(max_clust != original_cluster){
    // record that the node is changed
    GLOBAL_verts_changed++;

    // update the node's cluster
    original_node->count = max_clust;

    // increment distance while handling overflow
    // (if it overflows to 0, evaluates to FALSE and then skips increment)
    new_dist = new_dist+1 ? new_dist+1 : new_dist;

    // assign new distance to the node
    original_node->dist = new_dist;

    // put any nodes we still need to process back into the queue
    add_remaining_to_queue(max_clust, neighbors, weights_arr, num_edges, queue);
  }

  /*
   * lots of postprocessing stuff and other code ...
   */
}
```

## Casting Bugs

Where is the bug? Well, it turns out that I misunderstood how C handles simple arithmetic with variables of different types. The erroneous line is here:

```c
// increment distance while handling overflow
// (if it overflows to 0, evaluates to FALSE and then skips increment)
new_dist = new_dist+1 ? new_dist+1 : new_dist;
```

My assumption was that `new_dist + 1` would be of type `uint16_t`. This is...sort of correct, but mostly wrong. There are a couple pieces to this line:

- `new_dist` is of type `uint16_t`
- `1` is a constant, which is implicitly of type `int`
- `int` is a 32-bit type on my machine (and most modern machines, but not guaranteed)

C adds the two numbers together and then casts them to `uint16_t`. The trick is *when* that happens. For comparison, the following seemingly identical code *does* work:

```c
new_dist = new_dist + 1;
if(!new_dist)
  new_dist = new_dist - 1;
```

Hopefully that starts to clarify the issue. The cast to `uint16_t` happens on *assignment*, not midway through calculations. Casting does happen during calculations, but this is usually just upcasting to the largest type. This means we have the following order of evaluation:

1. `1` is implicitly of type `int`
2. `new_dist` is of type `uint16_t`, so it gets promoted to type `int` for addition
3. the result of `new_dist + 1` is **not** cast to `uint16_t` prior to evaluating the `true/false` check of the ternary operator
4. the ternary check is always `true`, so we return `new_dist+1`
5. `new_dist+1` is cast to `uint16_t`, which may overflow to `0`.

The reason the second code block works is because there's an assignment in the middle, so `new_dist = new_dist+1` forces a cast before the `true/false` check.

Why does this cause an issue? Well, after 65,535 hops, the distance overflows to 0. That means the algorithm regards this node as an origin, allowing it to cheat the attenuation mechanism. Given sufficient hops, it could create a new fake source node as well, intensifying the problem. The kicker is that a sufficiently long chain only has to appear once at any point for it to take over, so one could appear early on before the algorithm starts to converge and then rapidly dominate. Using self-loop filters also increases the chance of a long chain appearing since spurious links have a harder time breaking up chains (which is what we want, but it does also exacerbate the problem).

## The Fix

Fortunately, the hardest part of this process is finding the single line causing this problem in over 3,000 lines of C and R code. The fix itself is pretty simple.

First, I upgraded the type to `uint32_t` to allow for longer chains prior to a potential overflow. Second, I fixed the check to instead check if the value is less than the max allowable value, rather than relying on overflow behavior:

```c
#define DIST_UINT_MAX 4294967295ULL

// ...other code

// new_dist now of type uint32_t
if(new_dist < DIST_UINT_MAX)
  new_dist++;
```

Like I mentioned, it's a pretty simple solution. Finding it in the first place was most of the issue! These are the kinds of problems that are super frustrating in the moment, but feels awesome when you finally figure it out.

Anyway, thanks for reading!
