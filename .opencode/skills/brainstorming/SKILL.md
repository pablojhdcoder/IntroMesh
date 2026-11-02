---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, modifying behavior, or planning anything new, in software or out of it (a talk, a business, a renovation)."
license: MIT
---

# Brainstorming

Find out what the partner actually wants, and why, before anything gets built.
What you believe they want is usually thinner than it feels. Good questions
help them think it through; when you understand the why, you make the hundred
unmentioned decisions the way they would have.

## Look before you ask

In this repo, dig in before your first message. Read what they pointed at and
the code or docs it connects to until you can explain how the relevant parts
work today and what the change would touch. Start with `docs/DESIGN.md`
(required before any UI), plus `docs/ARCHITECTURE.md` and `docs/PRODUCT.md`
as relevant. Never ask what the project or their context already answers.

## Question-first discovery

Move the work forward in your first message:

- **Detailed request:** echo it back in ~200 words in your own words — what
  they want, who it is for, why — plus what you found (how the relevant
  parts work today, what the change touches, constraints or cheaper paths).
  End with one line inviting corrections, then one question about what they
  want: the open point whose answer would most change what gets built.
- **Vague request:** one open question in their own terms about the biggest
  unsettled thing. Say what the answer would change.

Each message ends with one question: a single sentence, plain language, no
jargon, pitched just above where the partner is. Open questions come first —
their own words carry intent options cannot. Offer a short menu only when
they are stuck. If they say "just dive in", this skill is done: state any
significant how-it-gets-made choice in one plain line, then proceed.

## Ground to cover

Territory, not a script. Never read these out as a list:

- What kind of thing this is, and what makes it special
- Why now, and what success looks like to them
- Goals, non-goals, anti-goals (what makes it a failure even if it works)
- Prior art: what they loved or hated elsewhere
- Current state: what exists, what they tried, details they care about

Make every question specific to their project and last answer. Build
Socratically on what they said or what you found, so it surfaces a
consequence they may have missed. Play back each understood chunk in
200-300 words, then ask what is wrong or missing.

## Approaches, then design doc, then plan

1. **Lay out the approaches** in a message of its own. Present two or three
   real alternatives grounded in what the project does, each with tradeoffs.
   Recommend one and say why; the partner picks. If there is genuinely one
   sensible way, say so and explain why the others do not fit.
2. **Write the design doc** (short for a small change, full for a project:
   intent and why, goals/non-goals/anti-goals, constraints, approaches with
   the pick and why, decided how vs. left to the builder).
3. **Get approval of that doc.** Nothing gets built until they approve it —
   no product code, scaffolding, dependency installs, or implementation
   skills. Reading and exploring are fine.
4. **Hand off to planning:** invoke the writing-plans skill to write
   `docs/plans/YYYY-MM-DD-<name>.md`. No code before the plan exists.

A spike they said yes to may be built; it stays labeled throwaway with no or
minimal tests, and keeping its output is a new request back through the gate.

## IntroMesh constraints

Reuse tokens and shadcn components; strict TypeScript with Zod on external
inputs. Discovery requires consent; never invent rows, matches, or model
text — synthetic fixtures carry the `demo` mark. Product copy is English.

## Red flags

Filling in silent defaults, offering a menu of what they might want before
they describe it, writing the doc before they pick an approach, treating
"sounds good" to an idea as approval of an unwritten doc, or building on a
spike without a new request — all mean stop and return to the conversation.
