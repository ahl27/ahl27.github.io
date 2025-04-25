---
title: "My SWE Interview Experiences: Amazon vs. Meta vs. Google"
date: 2025-04-18
permalink: /posts/2025/04/faang-interviews/
tags:
  - blog posts
---

I just finished an interview at Google that I wasn't initially expecting to get. I prepared for it like I had for my Meta interviews, but the experience was significantly different. I feel like people online treat FAANG/tech interviews as if they're all the same, but these experiences could not have been more different...so I figured it would be helpful for someone out there if I documented how they compared to each other.

## Background

Everyone online is always asking about GPA/major/background/etc. when people post about FAANG interviews. I don't have a crazy resume, so I'm not sure how much this really matters. My undergrad degree is in math, and I did some CS research during the degree. After that, I got my PhD in bioinformatics focusing on building software tools for large-scale comparative genomics. If you're reading this, you're already on my website, so you can see my resume for yourself on the [CV page](https://www.ahl27.com/cv/).

All of these interview experiences are for software engineering (SDE/SWE) roles, not research or data science. Meta and Google were New Grad PhD positions, and Amazon was a New Grad position for undergrads that I applied for at the end of my bachelor's degree. I'll detail them sequentially and then compare how they went at the end.

Additionally, I mention job levels multiple times throughout this post and try to give comparison points. There's a very nice chart online that shows how they measure up to each other available [here](https://www.hellointerview.com/blog/understanding-job-levels-at-faang-companies).

## Amazon

*Position: New Grad SDE-I*

The funny thing about this role is that I applied for it by accident. At the end of my undergrad degree I was searching desperately for an internship I could do in the summer between undergrad and starting my PhD, and I was having absolutely no luck. I ended getting up a single interview, at what I thought was an internship at Amazon AWS. It turns out that I had accidentally applied for a full-time new grad role, and I didn't realize until the final round of the process! After I got the role, they let me downgrade it to an internship because I was returning to school.

I interviewed for this position around September 2019 with an intended start date in Summer 2020. This was pre-COVID, but Amazon was trialling a new fully virtual interview process for new grad roles. I'll note that I also re-applied to a New Grad SDE-II (PhD) position at Amazon in 2025 and went through an almost identical interview experience.

My Amazon interview process had a total of five rounds.

First, the debugging round. This consisted of around five problems in 20 minutes. Each problem was a short piece of code containing a bug and the expected behavior of the code. You could run it to check the output. It sounds like a lot, but the bugs were pretty small (e.g., flipping a `<` sign to `>`) so they were pretty easy. All of the bugs were logic errors, meaning that the original code ran fine, it just produced the wrong output.

Next, the coding round. This consisted of two LeetCode problems in 70 minutes, both around easy to medium difficulty. I remember prepping really hard for this in undergrad, but when I took it again in 2025, it was easier than I remembered. In my original interview, I solved one problem with a suboptimal solution because I couldn't figure out the optimal one and still passed. For this interview, getting a working solution that passes all the test cases is much more important than getting most of an optimal solution that doesn't run.

The third round is a workplace simulation round, which honestly I felt was pretty fun. You get a simulated email and Slack, and you get messages from virtual coworkers about things happening throughout the day. The "day" is really like an hour and all the solutions are abridged (so more like just saying what you would do and then skipping to the consequences). I won't reveal details on the simulation since it was literally exactly the same when I took it again in 2025, but my advice would be to just think about your decisions, remember the Amazon LPs, and be a team player.

The fourth round is like a math / logic test combined with a personality test. I don't have much to say about this one except that I think it's pretty silly. I'm not a fan of brainteasers/logic puzzles or personality quizzes for interviews...if you need to evaluate how someone works, just give a behavioral interview. Regardless, this is the kind of test where you just need to be yourself, but if necessary, be a version of yourself that the company would love to have on the team.

Finally, I had a quick phone interview with an Amazon SWE to talk over my answers to the coding rounds. He asked me about my one suboptimal solution and I described how I would have improved it if I had had more time.

## Meta

*Position: Research Scientist (Systems/Infrastructure, PhD)*

I talked in depth about my interview experience at Meta in a [previous blog post](/posts/2025/02/meta-interview/). This position is pretty similar to an E4/IC4 SWE role (or SDE-II at Amazon, L4/SWE-III at Google). If you want a detailed description of the process, see my previous post -- I'll just briefly recap here and then contrast it with other roles at the end.

My interview at Meta had six rounds: the phone screen, three coding rounds, one systems design round, and then one behavioral round. The phone screen was identical to the coding rounds, so it was basically four coding rounds. One coding round was extra; they often assign an extra round for training purposes that may or may not count (just act like it does, if you get one). Every round had 35 minutes for the main content, 5 minutes for questions at the end, and 5 minutes of buffer for things like technical issues. These were hard stops; the interviewers would start the interview, and then 35 minutes later they had to close their notetaking / interviewing portals before answering other questions.

Each coding round was two LeetCode problems in 35 minutes with a live interviewer. Each pair of problems averaged about medium difficulty, but on the harder end. Meta doesn't add new questions very often, so you can get great prep by drilling the LeetCode Meta 3-month question list (need LeetCode premium, it's definitely worth it for this). My interviewers were available to give some feedback / assistance, but there wasn't really time to have detailed discussions with them. I'd personally just plan on not getting any interviewer hints. You aren't able to run any code, so you have to know your stuff without google/AI and be able to debug your code by hand.

Systems design and behavioral interviews were pretty standard. At Meta, the behavioral is required to be with someone that has a PhD if you're interviewing for a position that requires a PhD. The other rounds are with anyone that's qualified.

## Google

*Position: New Grad SWE (PhD)*

My Google interview was quicker than most because I already had an offer from Meta (and potentially also because I had a referral, though I'm not sure). I skipped straight to the full loop interview, so no phone screen. This consisted of three coding rounds and a behavioral interview. This role is for an L4 position (Google SWE III, same as Meta E4/IC4, Amazon SDE II).

Each coding round was scheduled for 45 minutes, though most of my interviewers stayed on longer to talk with me more. The format was working through one coding problem, which was LeetCode-style but not directly from LeetCode. The problems were a lot more ambiguous than Meta or Amazon; the interviewer would start with a very general problem description, and you'd have to spend some time talking with the interviewer to clarify the exact details and expectations.

All my interviewers had PhDs, so maybe they try to get PhD interviewers for the PhD SWE roles (could also have been coincidence). The interviewers were super helpful and I had great discussions in all of them -- it really felt like working on a problem with someone and less like a super intense interview. The problems themselves I would put at around LeetCode medium difficulty. Like at Meta, you couldn't actually run any code, you'd basically just type code into a shared google doc with syntax highlighting.

The last round is called the "Googleyness round", but it's really just a standard behavioral interview. The questions are pretty much exactly what you'd get at any other behavioral.

Note that Google is a bit unique in that there is another phase after the full loop of interviews. To actually get an offer, you have to successfully match with a team that wants you and has sufficient headcount. If you take a quick look at Reddit or Blind, you'll see some people that have been stuck in team matching for months. It seems to me like Google is slightly more inclined to pass people through the full loop because there's an additional check before receiving an offer (though that could just be my imagination).

On team matching, it's also worth noting that the order of full loop and team matching isn't fixed. From reading a lot of sources online, I've gathered that the process is typically full loop -> hiring committee -> team match, but that changes from time to time. Recruiters also have the ability to delay your hiring committee review until you've matched with a team if they think your interview results were borderline (a manager that wants you can be enough of a boost to pass with slightly worse interview results). I went through a partial team match phase proir to even doing my full loop because I had another offer, so that's also on the table. The good news is that (at least in my experience) Google recruiters are a lot more open about the process than Meta or Amazon, so you may be able to find out where you are in the process by just asking.


## How do they compare?

From my perspective, the interviews were all quite different despite all being roughly a pre-screen, some coding rounds, and a behavioral.

Meta was by far the most intense coding interview I have ever done. Solving two medium-hard LeetCode problems optimally in 35 minutes with good code and no external help (autocompletion, google, etc.) is a really, really fast pace. This felt like I was sitting for an exam; I had minimal help from interviewers and had to work extremely quickly on relatively difficult problems. The upside is that it's easy to study for Meta, since you mostly know what problems they're going to ask. I will mention that I got a LC-Hard level question that isn't on LeetCode and managed to solve it optimally, and to this day I'm pretty proud of myself for that.

Amazon wasn't as intense, but there's no margin for error. Since there's no human in the loop, it's a lot tougher to get partial credit. In one of my Meta rounds I couldn't get my code perfect in time, but I could describe the logic enough that the interviewer knew I could do it if I had had more time -- this was not the case at Amazon. Being able to run code is a double-edged sword; yes, you can check your work faster, but it also means you have to deal with syntax errors and knowing the correct functions. At Meta/Google we could just agree on syntax for functions I couldn't completely remember, but not at Amazon. Overall, I'd say it's the easiest interview technically, it's just an all-or-nothing scenario. (*Note: This only applies to the online New Grad process. There's also an on-site interview loop with live interviewers that I've heard is much more intense, but I don't have any experience with that one.*)

Google was my favorite out of these interviews. It was the same pace as Amazon (one problem per ~35min), but the actual experience was the exact opposite. A lot of my time was spent discussing the problem details with the interviewers, who were all very responsive. What I liked about the experience was I felt like the interview allowed me to showcase how I approach solving software engineering problems, rather than just testing my memorization of LeetCode. I felt less pressure, which I think helped me do better. The interviewers themselves also seemed more focused on working with me on the problem, rather than just evaluating if my final solution was optimal. Along those lines, the problems I got were mostly challenging from a problem-solving standpoint -- once you figured out the solution, coding it up was fairly simple. I'll note that I didn't get any dynamic programming or graph problems, so my experience may have been atypical.

Overall, I think the interview formats are better for different kinds of people. If you love grinding LeetCode (and are good at it), you could probably crush it at Meta. If you're a good programmer that isn't as fast at LeetCode, you'd probably do better at Google. If you're the kind of person that can do LC easy-medium problems that work without syntax errors or failed test cases on the first try, you'd probably do great at Amazon. Personally, the Google style felt the best for me.

## Conclusion

As always, I'll close by mentioning that the most important factor in passing FAANG interviews is being lucky enough to get them in the first place. It feels like a lottery on who gets selected. If you get an interview at one of these places, that's definitely something to be proud of, even if you don't end up passing--the whole process is brutal. Keep at it and stay sharp on DSA fundamentals, and you'll break through eventually.

Thanks for reading.