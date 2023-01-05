---
title: '6502 FORTH, Part 5: Multiplication for Peasants'
date: 2023-01-05
permalink: /posts/2022/12/SIXTH-mult/
tags:
  - blog posts
  - 6502
  - Forth
---

It's been a while since I worked on this project, and I wanted to ease back into it by implementing something auxilliary to get me back into the flow of writing assembly. It turns out the 6502 only has instructions for addition and subtraction, meaning that if you want any higher level arithmetic operations (multiplication, division), they need to be implemented manually. Furthermore, since we're implementing a 16-bit system, we'll have to make sure these operations work on 16-bit numbers. This post is going to cover multiplication--I'm still working out the best way to write a division algorithm.

What's this about Peasants?
---------------

Paul Dourish has [previously implemented 16-bit multiplication](https://github.com/dourish/mitemon/blob/master/stackext.a65), but I wanted to challenge myself to come up with my own implementation. It turns out there are a [lot of algorithms](https://en.wikipedia.org/wiki/Multiplication_algorithm) for multiplying two numbers together, but the one that stood out to me the most was a funky algorithm called [Peasant Multiplication](https://en.wikipedia.org/wiki/Ancient_Egyptian_multiplication). I'm not really sure where the name came from, but it's also referred to as ancient Egyptian multiplication.

The algorithm is pretty simple, and its operations translate very well to computers:

```
1. Write the multiplier and the multiplicand in two adjacent columns (left and right)
2. Write each successive row by doubling the previous left entry and halving the previous right entry
3. Cross out any rows with an even number on the left entry
4. Sum up the non-crossed out entries in the right column
```

It's a little hard to explain without an example, so I'm going to walk through how we'd use this to carry out the operation `50 * 17`.

First, we write out the two numbers in adjacent columns, then form the remaining rows by doubling/halving the previous entries:
```
50   17
25   34
12   68
 6  136 
 3  272
 1  544
```
We drop the remainder at each point, and stop once the left row is `1`. After this, we eliminate the rows with even entries on the left.

```
25   34
 3  272
 1  544
```
Finally, we add up the remaining numbers on the right column: `34 + 272 + 544 = 850`, which is the correct answer!

This is an especially nice algorithm for the 6502, since it uses only addition and multiplication/division by `2`, which are readily implemented through addition (`adc`) and bitshifting operations. Written in pseudocode, the algorithm looks like this:

```
let m=multiplier, c=multiplicand
let result=0
while c > 0:
  if m is even:
    result += c
  m = m*2
  c = c/2
return result
```

Now it's just a matter of implementing this in the 6502 in a way that's compatible with my 16-bit stack structure. 

Implementing the Algorithm
---------

To quickly recap, the stack is located at the top of the zero page, growing downward and indexed by the `x` register. To be consistent with my other arithmetic operations, this implementation should remove the top two entries from the stack and push the result of them multiplied together. I'm going to write it in a few pieces, starting with the simplest part: initialization.

{% highlight nasm %}
mult16:
  ; First add some space on the stack
  dex
  dex

  ; Initialize both entries to zero
  stz stackbase+1,x
  stz stackbase+2,x
  
  ; run the algorithm, this should store the result in the area we just allocated
  jsr multiplier_algo

  ; store the result into where the stack will end up being
  lda stackbase+1,x
  sta stackbase+5,x
  lda stackbase+2,x
  sta stackbase+6,x

  ; shrink stack back down two positions
  inx
  inx
  inx
  inx
  rts

{% endhighlight %}

This part is pretty simple. As mentioned before, we're going to pop the two top entries and push the end product. To accomplish this, we'll first allocate space at the top of the stack, calculate the product of the two entries below it, copy the top entry two entries down, and then pop the top two entries. Right before the final pop, entries (1) and (3) are identical. Popping two values means that the top of the stack is now the product we wanted, and the other two values have been removed. 

Now we can move onto the `multiplier_algo` section. There are three main pieces of this to implement:

1. Add the multiplicand to our temporary value if the multiplier is odd
2. Multiply and divide the multiplicand and multiplier, respectively
3. Check if the multiplier is 1, and if so, return

Starting with the first part, the code looks pretty similar to when I implemented addition for the stack.

{% highlight nasm %}
multiplier_algo:
  lda #$01
  bit stackbase+5,x         ; test if c is odd
  .(
    beq skip                ; skip to shift if even
    clc                     ; else add
    lda stackbase+3,x
    adc stackbase+1,x
    sta stackbase+1,x
    lda stackbase+4,x
    adc stackbase+2,x
    sta stackbase+2,x
    skip:
  .)
{% endhighlight %}

All we do here is a bit comparison test between `1` and the multiplier, and if it's odd, we add the multiplicand to our temporary space. 

Next comes the bitshifting, which taught me a little about the operations in the 6502. The opcodes for the 65c02 contain two types of shift: `asl` for **A**rithmetic **S**hift **L**eft and `rol` for **Ro**tate **L**eft. For shifting right, we have `rsl` (**R**ight **S**hift **L**ogical) and `ror`. Looking at the opcode reference, the operations are defined as follows:
```
asl
C <- 7 6 5 4 3 2 1 0 <- 0

rol
C <- 7 6 5 4 3 2 1 0 <- C

rsl
0 -> 7 6 5 4 3 2 1 0 -> C

ror
C -> 7 6 5 4 3 2 1 0 -> C
```

`C` stands for the Carry bit, which is one of the internal flags of the 6502. `asl` and `rsl` both shift a `0` into the new space, and shift the outgoing bit into the carry register. `ror` and `rol` both *first* shift the carry bit into the new position, *then* shift the outgoing bit into the carry register. This means that, if we have a 16-bit number, we can do a complete right/left shift in three operations:

1. Clear the carry bit
2. Shift the upper byte right (for left shift, shift the lower byte left)
3. Rotate the lower byte right (for left shift, rotate the upper byte left)

This guarantees that the right/leftmost bit is correctly shifted to the lower/upper byte (resp.). In code, this looks like the following:

{% highlight nasm %}
  ;; Bitshift the values
  clc
  asl stackbase+3,x         ; multiply m by two (note MSB is at highest address)
  rol stackbase+4,x

  clc
  lsr stackbase+6,x         ; divide c by two, starting with LSB
  ror stackbase+5,x
{% endhighlight %}

Finally, we just need to check if the divisor is zero. If so, we exit the loop. Since each number is stored in two addresses, we need to make sure both are zero.

{% highlight nasm %}
  ;; Check if the multiplier is now zero
  .(                        ; check if c is zero
    lda #$FF
    bit stackbase+5,x
    bne skip
    bit stackbase+6,x
    bne skip
    rts
    skip:
  .)
  jmp multiplier_algo
{% endhighlight %}

We're comparing with `0xFF` here so that if any of the bits of the memory are set, the result will be nonzero. If both are zero, we return to the original loop. Putting it all together, we can write this as a single function to avoid using `jsr/rts`:

{% highlight nasm %}
mult16:
  ; First add some space on the stack
  dex
  dex

  ; Initialize both entries to zero
  stz stackbase+1,x
  stz stackbase+2,x
  
  ; run the algorithm
  mult16loop:
    lda #$01
    bit stackbase+5,x         ; test is c is odd
    .(
      beq skip                ; skip to shift if even
      clc                     ; else add
      lda stackbase+3,x
      adc stackbase+1,x
      sta stackbase+1,x
      lda stackbase+4,x
      adc stackbase+2,x
      sta stackbase+2,x
      skip:
    .)

    ;; Bitshift the values
    clc
    asl stackbase+3,x         ; multiply m by two (note MSB is at highest address)
    rol stackbase+4,x

    clc
    lsr stackbase+6,x         ; divide c by two, starting with LSB
    ror stackbase+5,x

    ;; Check if the multiplier is now zero
    lda #$FF
    bit stackbase+5,x
    bne mult16loop
    bit stackbase+6,x
    bne mult16loop

  ; store the result
  lda stackbase+1,x
  sta stackbase+5,x
  lda stackbase+2,x
  sta stackbase+6,x

  ; shrink stack back down two positions
  inx
  inx
  inx
  inx
  rts
{% endhighlight %}

Now that we've implemented it, we just have to test that it works right.

Testing the Implementation
--------
I'm returning to my `stacktest` script to test if the multiplier works correctly. For this, I'm going to test three conditions:

1. Multiplication of two values that are both zero in the upper byte (no rollover)
2. Multiplication of values with non-zero upper byte entries
3. Multiplication of values resulting in a value greater than `0xFFFF` (test if truncation is correct)

For these, I've devised the following tests:
```
  10  *    8 = 0x000A * 0x0008 =   0x0050 =      80

1195  *   24 = 0x04AB * 0x0018 =   0x7008 =   28680

1195  * 2584 = 0x04AB * 0x0A18 = 0x2F1E08 => 0x1E08 = 7688 (truncated)

```
Each test for a given multiplication looks like this:

{% highlight nasm %}
#include "memlocs.asm"
* = ROMSTART

;; Quick tests to make sure the stack is working properly

;; main noop loop

main
  jsr initstack

  jsr multtest1
  jsr multtest2
  jsr multtest3         
  brk

multtest1:            ; 10 * 8 = 80 (0x50), this test has no rollover
  lda #$0A
  sta stackaccess
  lda #$00
  sta stackaccess+1
  jsr push16
  lda #$08
  sta stackaccess
  lda #$0
  sta stackaccess+1
  jsr push16
  jsr mult16
  rts

multtest2:
  ...

multtest3:
  ...

.dsb $fffa-*,$ff
.word $00
.word ROMSTART
.word $00
{% endhighlight %}

All we're doing here is pushing the values to the stack, then multiplying them. If the code is correct, the memory at the end should include the correct values `0x0050`, `0x7008`, and `0x1E08`. Since they're stored little endian, the memory should look like this:

```
Memory    Data

 0xFA      08
 0xFB      1E
 0xFC      08
 0xFD      70
 0xFE      50
 0xFF      00
```

Running it through, we get the following:

![](/images/blog_images/mult_stacktest.png)

There's some junk after `0xFA`, but that's how our stack works. The `x` register correctly points to `0xF9`, the fourth space in the stack, so all is good! 

Next Steps
--------

That's it for my multiplication implementation! Next I'll either be returning to the core Forth interpreter, or writing a division/modulo algorithm (haven't decided yet). As always, feel free to follow along my project [on Github](https://github.com/ahl27/FORTH).
