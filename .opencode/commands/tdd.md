---
description: Drive RED-GREEN-REFACTOR with the tdd-guide subagent (failing Vitest first)
agent: tdd-guide
---

Follow RED-GREEN-REFACTOR for: $ARGUMENTS

1. RED: write one failing Vitest test colocated with the code, run it, confirm it fails for the right reason.
2. GREEN: minimal implementation to pass (`npm test`, then `npx tsc --noEmit`, then `npm run lint`).
3. REFACTOR: clean up with tests green and re-run everything.

If $ARGUMENTS is empty, ask which behavior to cover first.
