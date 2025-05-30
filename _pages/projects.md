---
permalink: /projects/
title: "Projects"
excerpt: "Projects"
author_profile: true
---
------

This page details some of my many side projects I've worked on for fun. A description of the research projects I do for my work can be found on the [Research page](https://www.ahl27.com/research/). **Note:** some of my most interesting work is on [my blog page](https://www.ahl27.com/blog)!

-----
## 6502 Projects
-----

### 65C02 Emulator

![](/images/blog_images/emuExample.gif)

I wrote an emulator in C for 65C02 systems. The full code is available [on GitHub](https://github.com/ahl27/65C02Emulator). This program implements a GUI to monitor memory while executing programs, as well as complete emulation of all 6502 and 65C02 Rockwell/WDC opcodes. More details are available [on my blog](https://www.ahl27.com/tags/#emulator).

-----

### 6502 Breadboard Computer

![](../images/60B6FD7D-EF9F-4719-ABA5-AD8DA6B2D087.jpeg)

I built this computer following [Ben Eater's](https://eater.net/) guides on YouTube. It's a breadboard computer using a 65c02 microprocessor, with 32KB of RAM and 16Kb of ROM. Ben Eater initially connected a keyboard via PS/2, but I wanted my computer to be able to communicate with USB protocols. I used a Raspberry Pico to build a USB-to-PS/2 decoder that translates USB Keyboard input into serial PS/2 codes.

-----

### 65C02 Operating System (In progress)

I'm developing an operating system from scratch for my breadboard 65C02 computer (see Hardware below). This project is what led to the development of my 65C02 emulator, since I needed a better way to visualize operations happening on the processor and didn't like other available solutions. The OS drops the user directly into a Forth REPL. The project is currently in progress, but the current status can be seen [on GitHub](https://github.com/ahl27/FORTH).

------
## Keyboards
------

I love building mechanical keyboards (and honestly I have too many at this point). Pictured are my favorites; at some point I'll get them all up here. My daily drivers are both Vault35s--rainbow for work, and black for at home.

**RainbowVault**

Vault35 with a custom rainbow cerakote by Jake at the P3DStore. Lucy Silent switches and DSA weirdo milkshake caps--definitely my favorite of the boards I own.
![](/images/rainbow_vault35.png)

**Oracle**
Oracle from the [Mechvault](https://mechvault.net/). Switches are a mishmash -- top row keys are Gateron Oil Kings, bottom four are Lucy Silents, three keys (Branch, Merge, Reset) are Momoka Frogs, and the rest are Outemu Honey Peach v2s. Keycaps are GMK Oblivion v2.

![](/images/oracle.jpg)

**Vault35 + 16**

Vault35 with a matching Vault16 macropad. Got this because my RainbowVault was getting dirty at work, and since that board is the only one of its kind, I figured I should keep it somewhere safe and switch to something more durable. Honey Peach switches with KAM blank keycaps from [Coffee Break Keyboards](https://www.cbkbd.com/). Base is frosted clear polycarbonate with (obvious) RGB underglow, I'll end up turning it off as soon as it starts to get old.
![](/images/vault35and16.png)

**Vault35**

Black cerakoted aluminum base, Gateron Black switches, and MT3 Operator caps.
![](/images/vault35.png)

**Bully**

Gasket mounted 40% keyboard with black cerakoted base, Gateron Oil King switches, and MT3 Black Speech caps.
![](/images/bully.png)

**QAZ/Qull**

Green anodized frame, Cherry MX Black switches, MT3 BoW and WoB caps, and artisan caps from [Asymplex](https://www.asymplex.xyz/).
![](/images/qazboard.png)

**Waterfowl**

Momoka Frog switches, nice!nanos, and the remainder of the MT3 BoW and WoB caps from the Qull. My first wireless!
![](/images/waterfowl.png)


**Helidox Corne**

Cherry MX Silent Black switches with o-rings, pictured with DSA caps but currently using MT3 Godspeed.
![](/images/FA569DF1-896A-4798-A179-EEA326C7B64E.jpeg)

**OLKB Preonic**

Frosted acrylic base, Cherry silent red switches, XDA caps.
![](/images/preonic.png)

**Big Dill Extended v2**

Cherry silent red switches, XDA caps.
![](/images/bde2.png)

**Tofu 65**

Gateron brown switches, KBDfans OEM caps, brass weight. My first keyboard!
![](/images/65keyboard.jpg)

&nbsp;

&nbsp;

-----

-----
## Programming Languages
-----

### Froth
![](../images/froth.png)

`froth` is a Forth implementation that runs on top of R! You can download it from CRAN, and learn to use it by checking out [my tutorials](https://www.ahl27.com/tutorials).

-----

### Whitespace Interpreter
I'm a big fan of esoteric languages, and one that really caught my eye was [Whitespace](https://en.wikipedia.org/wiki/Whitespace_(programming_language)), a Turing-complete programming language using only whitespace characters (space, tab, and return). I wrote up [this interpreter](https://github.com/ahl27/whitespacehttps://github.com/ahl27/whitespace) in Python for running Whitespace code, mainly as an exercise for learning how interpreters work. One of the big challenges was that popular text editor programs automatically reformat whitespace characters (ex. tabs to spaces), which immediately ruins Whitespace programs.

-----
## Other Projects
-----

### Web Server

![](../images/EDF54D17-43E0-4847-BD59-0C86817DD8AB.jpeg)

I built a web server to centralize my files, gain some experience with LAMP stacks, and have a robust compute environment that I could access remotely from something like an iPad. My web server hosts NextCloud to store my files on, and runs RStudio Server edition on a virtual machine.

I'm interested in adding on a small supercomputer cluster with something like Kubernetes on Raspberry Pis for prototyping, though unfortunately due to supply chain shortages this addition is currently on hold.

-----

### SynCIPHER Web App

![](../images/SynCIPHERimg.png)

In the process of developing an `R Shiny` app to make analysis with `DECIPHER` and `SynExtend` simpler for end-users. Code is available at https://github.com/ahl27/SYNCIPHER-app, and the end results will be publicly released soon!

-----

### Academic Paper Finder
I wrote [this script](https://github.com/ahl27/findPapers) to discover more papers similar to what I'm currently reading. It takes as input a collection of PubMed ID's and search terms, and then traverses the network of citations to find more papers containing the search query. It then uses TF-IDF to convert each paper's abstract into a vector, and then clusters the result with K-means clustering. I wanted this to run on my iPad, so I used Pythonista, which unfortunately does not have access to most widely used libraries for NLP (such as pandas or scikit-learn). As a result, everything is implemented from scratch, including TF-IDF and K-means.

In the future I'm going to investigate hierarchical clustering methods (ex. UPGMA), using SciBERT for clustering, and having the script search for terms for you (removing the need for initial PubMed IDs to search from).

-----
