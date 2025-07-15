---
permalink: /projects/6502/
title: "6502 Projects"
excerpt: "6502 Projects"
author_profile: true
---
------

I'm really interested in programming on small devices with limited power and instruction sets. Unsurprisingly, I have a huge love for 6502 systems.

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