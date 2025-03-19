---
title: "The 'Research Scientist' Role at Meta: What is it, exactly?"
date: 2025-03-19
permalink: /posts/2025/03/meta-rs-types/
tags:
  - blog posts
---

My [last post](https://www.ahl27.com/posts/2025/02/meta-interview/) detailed my interview experience at Meta for a "Research Scientist" role. However, some people I know also interviewed for "Research Scientist" positions and had *completely* different experiences. It seems like the title "Research Scientist" is what's given to employees with a PhD, and their actual responsibilities can vary widely. I did some research (no pun intended) on this and thought I'd share what the difference in the process for each position looks like, both based on my experience and what I've read online.

Research Scientist (RS) positions seem to fall into four broad categories:
- Software engineering (SWE) focused positions
- Data science focused positions
- Machine learning focused positions

This isn't exhaustive, but they're the most common types of roles you can find on the Meta careers website. You can determine what you're interviewing for based on the job title, the qualifications and responsibilities, and the interview process itself.

## SWE-focused positions

SWE-type RS roles tend to be similar to a mid-level software engineer. This is the position I interviewed for (and ended up accepting). This position seems to be more focused on standard software engineering, and based on conversations I've had with current employees, the evaluation metrics are identical to standard SWEs. Positions like these tend to be listed as "Research Scientist (PhD) -- Systems and Infrastructure" (or similar mention of Infrastructure/Product), and look for strong coding experience. The full interview loop typically consists of:

- Coding Rounds (2): SWE coding interviews, usually LeetCode-style and averaging LC Medium difficulty. Expectation is to solve two per interview.
- Systems Design: This is a SWE-style systems design interview, meaning you'll be designing a software product. Think of like "Design Yelp" or "Design a Web Crawler".
- Behavioral: Standard behavioral interview, they're pretty much always the same at Meta. The only difference between this and a SWE behavioral interview is that it'll be conducted by someone with a PhD, so they'll have a similar background to you.

The phone screen is a single coding round, identical to the full loop coding rounds. The expectation with these roles is that you'll be doing mostly standard software development, but you may be able to do some research-type problems. You are most likely not going to be publishing research. I covered this process in a lot more detail in [my previous blog post](https://www.ahl27.com/posts/2025/02/meta-interview/).

## Data Science-y positions

DS-style roles are usually marked as "Research Scientist (PhD) -- Central Applied Science". Central Applied Science (CAS) is a recent organization; it was called "Core Data Science" until at least mid-2022, which indicates what the focus in these sorts of roles is. An old overview of their goals can be found [here](https://research.facebook.com/blog/2022/6/research-highlights-from-the-core-data-science-team-at-meta/). I believe that Quantitative UX Research roles also fall into this category. The interview loop for CAS consists of the following rounds:

- Research presentation: Present some paper or work you've done to a group of CAS research scientists.
- Specialized Coding: Basically just exploratory data analysis. You'll be given a dataset and you'll have to do exploration, analysis, and modeling, and then suggest some future avenues to extend analyses in the future.
- Software Engineering: Easier version of a SWE coding round, they ask fewer questions and the questions tend to be more data science-y. That's not to say it's easy; you definitely still need to have solid LeetCode skills for this part.
- System Design: Closer to ML systems design than the standard SWE "systems design" interview. Example questions are provided [here](https://huyenchip.com/machine-learning-systems-design/exercises.html#exercises-rWl8SQW), but they're usually variants of recommender systems. For example, how would you build a system to suggest related questions in a website like StackOverflow?
- In-Domain Technical: This is a statistics/math exam, but the exact details depend on your background. People that have interviewed in the past have mentioned they'll ask foundational questions like using Bayes' Theorem and explaining the intuition behind it, as well as more open-ended questions like talking through which statistical analyses are appropriate for a given question about data.
- Behavioral: Same as the SWE-focused positions, advice that applies to any Meta behavioral interview probably works here too.

The phone screen is basically a single interview combining aspects of all of these interviews. This is the kind of role you'd want to end up in if you're in economics, social science, data science, statistics, or related fields. These positions have more opportunity to publish (depending on the team), and they typically investigate research questions related to Meta's products.

## AI/ML Research positions

I don't have as much reference for these types of positions, and they tend to be the most competitive from the groups on this list. There's a much more in-depth description of ML research interview processes across multiple companies available [here](https://generalizederror.github.io/My-Machine-Learning-Research-Jobhunt/). Based on my research online, the interview processes for these positions are pretty varied. There are some roles that go through a centralized process, and others that are more team-specific.

The centralized AI/ML roles seem to sit halfway between CAS and the SWE positions. They're usually advertised as positions prefixed with "Research Scientist, ML". The typical full loop interview consists of the following:

- Coding Interviews (2): SWE coding interviews, usually LeetCode-style and averaging LC Medium difficulty. Expectation is to solve two per interview.
- ML System Design: Same as the CAS RS Systems Design interview. If you're interviewing for a specific team then expect to see systems design questions related to what they work on.
- Behavioral Interview: Same as previous, can also touch on experience in research.

The phone screen is a LeetCode-style interview with a little discussion about research experience. These positions seem to have pretty broad responsibilities vary based on the specific team. There are definitely more options to publish than a SWE-style RS position, but the exact prioritization of publishing is team-dependent.

The previous sections tend to be general pipelines, where you'll go through a centralized process and then go through team matching at the end to determine what you'll actually be doing. However, there are some teams that recruit specifically for research scientist positions via non-centralized pathways, which may be via less advertised methods. Plenty of people online have been brought into the interview pipeline based on presentations at conferences.

I'd put most of the FAIR positions in this category, but they're sort of their own beast. The expectation for those is that you already have several first-author publications at high impact conferences, and you'd continue to be publishing regularly at Meta. It's basically like a postdoc / faculty position (depending on level). There's not a lot of reports on what that interview process is like, but if you're qualifying for those sorts of roles then you probably don't need any help with the interview anyway.

## Conclusion

That's it! I unfortunately can't share in-depth interview experience for any interviews except the ones I personally did. However, if you read this and want to share your experience with me (or you think something is totally incorrect), feel free to send me an email and I'd be happy to update the blog post (and give you a shout-out, if you'd like!).