---
name: receiving-code-review
description: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation
license: MIT
---

# Receiving Code Review

Handle review feedback with rigor, not performance. Verify every item against the code before changing anything.

## READ

Read each finding in full: severity, `file:line`, the claim, the suggested fix.

## UNDERSTAND

Restate the claim in your own words. If it is unclear, ask for clarification instead of guessing.

## VERIFY

Check the claim against the actual code and behavior:

- Correct: reproduce or point to the failing line and the rule it breaks.
- Wrong: push back with `file:line` evidence and quote the real output (`npm test`, `npx tsc --noEmit`, `npm run lint`).
- Out of scope: say so and propose where it belongs.

## EVALUATE

Rank by real risk to this repo: secrets and consent first, then correctness, then types, then style. Style nits never block.

## RESPOND

Reply to each item: accepted, rejected with evidence, or deferred with a reason. No blanket agreement.

## IMPLEMENT

Apply accepted items one at a time, with tests where behavior changes. Re-run `npm test`, `npx tsc --noEmit`, `npm run lint` and quote the results.
