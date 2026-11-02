---
description: Fix build/type/lint/test errors step by step with minimal diffs (build-fixer subagent)
agent: build-fixer
---

Get the project green. Start with: $ARGUMENTS
If nothing is given, run `npx tsc --noEmit`, then `npm run lint`, then `npm test`, and fix in that order.