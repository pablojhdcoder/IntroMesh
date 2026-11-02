---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
license: MIT
---

# Systematic Debugging

No fix without a root cause. Investigate first, reproduce second, fix third, verify fourth.

## 1. Investigate

- Read the failure output in full: stack trace, failing assertion, affected file and line.
- Trace the data flow backwards from the symptom to the origin. State what is confirmed vs. assumed.
- Check recent changes (`git diff`, `git log`) and boundary inputs (null, empty, invalid types, race timing).

## 2. Reproduce

- Write a failing Vitest test that reproduces the bug before touching production code.
- Confirm it fails for the right reason. If it cannot be reproduced in a test, document the exact manual steps.

## 3. Fix

- Apply the smallest change that addresses the root cause, not the symptom.
- Fix the implementation, not the test, unless the test itself is wrong.

## 4. Verify

- The reproduction test now passes. Run the full gates: `npm test`, `npx tsc --noEmit`, `npm run lint`.
- The regression test stays in the suite (`*.test.ts` next to the source).

## Rules

- One hypothesis at a time; disprove before moving on.
- Defense in depth: after fixing, ask what adjacent input would break the same way and cover it.
- Never invent rows, matches, or model text while debugging; fixtures carry the `demo` mark.
