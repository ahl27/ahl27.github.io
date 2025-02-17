---
title: "So what is it like to interview at Meta/Facebook?"
date: 2025-02-17
permalink: /posts/2025/02/meta-interview/
tags:
  - blog posts
---

I recently accepted an offer to join Meta as a Research Scientist following graduation from my PhD program. I've gotten a lot of questions on what the process looks like and how I prepared, so I figured I'd put together a blog post to keep everything organized in one place.

Note: This is all based on my impression of the interviews. Meta doesn't share interview results, so I have no idea how well I actually did. I could be way offbase for any of these descriptions. I did pass, so I feel like I at least did well on most of them, but who knows.

The process was a pretty standard interview loop for Meta:

1. Recruiter
2. Phone Screening
3. Full Loop
4. Results/Offer

I'll include the resources I used for each step in the corresponding section.

The position I was interviewing for was titled "Research Scientist (PhD) -- Systems and Infrastructure". From what I understand, this is more similar to a mid-level software engineering (SWE) position. Meta hires research scientists to do both research and SWE roles; what they actually do depends a little more on the team you end up on. In this case, my interview process was very similar to a standard SWE interview loop, and I'm expecting the teams I interview with to expect me to primarily write software for backend/tooling. Some of my peers have interviewed in Central Applied Science, which seems to be a more research-oriented role with interviews looking more like what you'd do as a data scientist.

There seems to be more variance in the first phase than any other component of the process. One of the biggest barriers is making it to this stage. I've gotten a lot of questions that are variants of "how did you get to the recruiter?", and sadly, I don't have any advice here. A recruiter reached out to me on LinkedIn via InMail, I sent back some basic info about myself, and then my phone screening interview was scheduled. Feel free to check out [my LinkedIn](https://www.linkedin.com/in/aidan-lakshman-894804b8/) if it helps, but I think getting lucky is a big factor in this stage.

The phone screening is really just a mini version of the full loop. I did a single coding interview at this stage, and then the full loop had more interviews. The overall process contained the following interviews:

- Coding (Phone screen)
- Coding #1
- Coding #2
- Coding #3
- Systems Design
- Behavioral

Typically, the full loop is two Coding, one Systems Design, one Behavioral. However, they sometimes add in additional interviews to train people learning to interview. These may or may not count, or they may count to a lower extent. You also probably won't know which interview is the additional one until you get there, so my advice is always just to try your hardest in every interview.

## Coding Interviews

All of Meta's coding interviews followed the same format. All the interviewers were very well prepared and rehearsed, so I'd expect any other interview to follow the same format.

Each interview is 45 minutes. The first 5 minutes are essentially buffer, 35 minutes go to the technical portion, and then there are 5 minutes at the end for questions/buffer. The time limits are very strict, they'll cut you off after that time is elapsed. I really enjoyed this format, it meant there wasn't any ambiguity or any concern that the initial interviews would run over and you'd have less time for the questions. In pretty much every interview, they'd say "I'm [name], I'm a [job name] at Meta. You'll have 35 minutes for two questions, are you ready?". No small talk, just interviewing.

Each interview was two LeetCode-style questions. They average a medium difficulty--some are asked that are *technically* easy but with a medium/hard optimal solution, and there are also some hards asked.

*Note: I'm not allowed to share the specific questions that I was asked due to NDA, so instead I'll share coding questions that would be good preparation for the interviews I had. None of the questions mentioned here were asked in my interviews.*

To give an idea of questions that would be good preparation, below is a list of questions with similar difficulty to what I experienced. I did my phone screen in C, and then the full loop in C++.

- [LC 1249](https://leetcode.com/problems/minimum-remove-to-make-valid-parentheses/description/): Minimum Remove to Make Valid Parentheses
- [LC 523](https://leetcode.com/problems/continuous-subarray-sum/description/): Continuous Subarray Sum
- [LC 33](https://leetcode.com/problems/search-in-rotated-sorted-array): Search in Rotated Sorted Array
- [LC 489](https://leetcode.com/problems/robot-room-cleaner): Robot Room Cleaner
- [LC 3211](https://leetcode.com/problems/generate-binary-strings-without-adjacent-zeros): Generate Binary Strings Without Adjacent Zeros
- [LC 1756](https://leetcode.com/problems/design-most-recently-used-queue/): Design Most Recently Used Queue
- [LC 311](https://leetcode.com/problems/sparse-matrix-multiplication/description/): Sparse Matrix Multiplication
- [LC 235](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/description/): Lowest Common Ancestor of a Binary Search Tree

I think people focus too much on memorizing solutions for these. From what I've gathered by doing these interviews (one of which with someone learning to interview) and watching interviewers talk about this online, they're not strictly grading on correctness. A perfect solution could be a no-hire if you don't display what they're looking for.

A good solution for a coding problem looks like this:

1. Clarify the problem, asking about edge cases or other constraints. For example, in a subarray sum problem, does the array have only positive values?
2. Describe your solution *without* code. Write a rough sketch of the approach, either in plaintext or in pseudocode. Make sure you and the reviewer are on the same page. You can mention runtime/memory complexity here if you know it, otherwise I'd mention it around (4) or (5) (or they'll ask you).
3. Code the solution, making sure variable names are descriptive and the code is well formatted. Use good coding practices, they absolutely do look for them!
4. Test your code by walking through the test cases provided by hand. I like to record relevant variables below the code and update their values as I step through the code. If you find bugs, fix them!
5. If time allows, think of other test cases and test them, prioritizing edge cases.

Of note is that Meta interviews don't allow any code execution. You basically get a text editor with syntax highlighting. That also means no autocomplete and no AI code generation. Make sure you know your stuff -- they won't care as much about small syntax issues (e.g., missing semicolon, arguments maybe in wrong order), but they will care about not knowing functions.

I think it's a good idea to try this out with friends. Sublime Text is a great representation of what you'll get in an interview. Focus on making sure you're always talking -- don't talk over the interviewer, but talk through what you're doing as you go so that they know what you're trying to do. Silently failing is much, much worse because the interviewer won't even know what you were attempting! This can also help you if you don't quite remember a function; there were a couple times where I said some variant of "This function does x, I can't remember if the arguments are in this order or the other but the result of passing these two inputs should be this output". That demonstrates you know what you're talking about, and any bugs that may be present are ones you'd be able to fix very easily. Doing that in practice is harder than it sounds, so it's worth working through.

For Meta specifically, I'd highly recommend LeetCode premium so you can sort questions by company and frequency. Meta tends to draw from the same question bank, so going to questions frequently asked in the last 3 months and sorting by decreasing frequency gives a really solid list of questions to study.

If you're starting from scratch, I really recommend going through [Neetcode](https://www.neetcode.io/roadmap), especially the first set of topics. I think dynamic programming, "Advanced Graphs", "Bit Manipulation", and "Math & Geometry" are overkill, I'd just skip them. I basically accepted that if I got a question that could only be solved with DP, I'd give it my best shot and probably just fail. Sometimes you have to optimize where you spend your time.

## Systems Design

Systems design is what I was most nervous about, since I didn't have a ton of experience in that area and it seems really daunting. However, it's really not as bad as it sounds. Again, I can't share specific questions, but if you could successfully design Yelp, you would've done fine in my interview. These interviews definitely get more challenging as you get to higher levels, but at E4 (mid-level) the expectation is that you're pretty new to systems design. They're looking for breadth of knowledge and good logical reasoning, but not necessarily the kind of in-depth knowledge that would be expected at the senior-staff level.

For prep resources, I really can't recommend [HelloInterview](https://www.hellointerview.com) highly enough. They do a terrific job, and the resources I got from premium were super, super useful (not sponsored lol). The full list of resources I used were the following:

- HelloInterview: as I mentioned, great stuff. Start with [Systems Design in a Hurry](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction), specifically "Key Technologies" and "Patterns". If you like that, the in-depth guides and AI mocks available with premium are totally worth it.
- [Jordan Has No Life](https://www.youtube.com/watch?v=iYIjJ7utdDI): Jordan and HelloInterview are the best Systems Design resources out there, no joke.
- Designing Data Intensive Applications: I got this as an audiobook (you can get it free with an Audible trial). I almost feel like it's too in-depth if you're totally new to systems design, but all the concepts are great to know. Good resource to have in your back pocket to reference in the future (or listen to in the background while you also do other study materials). The more you learn, the more valuable this will be.
- Grokking the Systems Design Interview: Honestly, I didn't feel like this was worth it. HelloInterview provided everything in GSDI and with more up-to-date materials and references. I noticed several parts of GSDI that were relatively outdated, which isn't what you want to be learning for this kind of interview.

The interview itself was pretty standard. It went through [Excalidraw](https://excalidraw.com/), which I'd recommend checking out in advance if you have an interview with it. Nothing crazy, interviewer defined the problem, I had 35 minutes to work through a solution, 5 minutes at the end for questions. Interview probed my knowledge a bit on some topics; I had to describe some data structures and write a little bit of code/pseudocode. I followed the HelloInterview delivery framework, which worked out well. Retrospectively, I felt a little overprepared for this interview.

## Behavioral Interviews

I feel like behavioral interviews are one of the trickiest sections because they're just so subjective. At the end of coding interview or systems design, you'll probably have a good idea of roughly how well it went. Behaviorals don't have that fixed goal of "design/solve X", so it's harder to know how well you did. The reality is that this is one of the most important sections of the interview process, so you really want to nail it.

I'll note here that this is the only part of the interview process that meaningfully diverged from the standard E4 SWE interview loop. According to my interviewer, behavioral interviews for research scientist positions at Meta are always conducted by someone with a PhD (so ostensibly also a research scientist, though I'm not 100% sure), and they focus more on your research/background.

I swear I'm not sponsored by HelloInterview...but one of their founders recently did an interview with someone that did a lot of behavioral interviews at Meta, and it was really helpful to understand where interviewers are coming from. Highly recommend watching/listening to it.

<iframe width="560" height="315" src="https://www.youtube.com/embed/bBvPQZmPXwQ?si=8DsvDDCkaqqoGxw7" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

Aside from that, I looked at some example questions and wrote out stories that I think fit them well. I did a bunch of mock interviews with friends and family and tried to nail down stories that felt good to me, came across well, and had enough depth that I could continue talking about them if the interviewer wanted to drill down. I'm not personally a fan of the STAR framework, I feel like it gets a little stuffy and can easily start becoming over-rehearsed...but that's just my personal preference.

For the actual interview experience, it went very well. I had a lot of stories prepared, but the interviewer had me drill down on the first one I mentioned. That naturally led into other stories/experiences, so it was a relatively fluid conversation. I felt like this was my best interview overall.

## The Timeline

As someone that agonized over the waiting periods, I know how much people value hearing about others' experiences with turnaround times. My timeline looked like the following:

- Recruiter reached out, asked for availability for the phone screen on the same day.
- I scheduled my phone screen for four weeks out to give me time to prepare.
- About two weeks after the phone screen, I was notified that I passed. This was over the winter holiday break, so it was likely longer than usual.
- I gave my availabilty and scheduled my full loop: the first two interviews were three weeks from notification, and the other three interviews were a week  after that.
- Got a call from the recruiter that my materials were being submitted to the hiring committee three days after my final interview finished.
- Received a verbal offer from the recruiter the three days after that, in the morning.
- Did a some market research and negotiating, then officially accepted about a week later.

From start to end, the process took almost exactly two months, comprising seven interviews and the initial recruiter screen. The recruiters and interviewers were all extremely nice and helpful; I don't think it could have been an easier experience given how many steps/interviews had to happen.

## Some Closing Thoughts

I don't think I can emphasize enough how luck-driven the process is. However, I find myself continuing to come back to the following well-known quote usually attributed to Roman philospher Seneca:

*Luck is when preparation meets opportunity.*

Getting an opportunity to interview for a position like this is incredibly driven by chance. There are many ways to increase your chances (most of which can be politely summarized as "networking"), but then you have to actually succeed at that opportunity. Plenty of people have lots of skills but never get an opportunity to prove it, and plenty of people have no skills but get lots of opportunity (and often don't pass).

Everyone wants to know how you get an interview at FAANG, and for that I have absolutely no idea...but I would say be ready/prepared enough that if you do get the chance, you can knock it out of the park.
