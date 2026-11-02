---
description: Run the full verification loop (build, types, lint, tests, secrets, diff) and report PASS/FAIL
---

Verify the current work ($ARGUMENTS; default depth is quick: everything except the build):

1. Build: `npm run build` (full depth only; stop on failure).
2. Types: `npx tsc --noEmit` (stop on failure).
3. Lint: `npm run lint`.
4. Tests: `npm test` (Vitest). Report passed/total.
5. Secrets: search `src/` for hardcoded keys (`sk-`, `api_key`, service-role values), secrets in `NEXT_PUBLIC_*`, and stray `console.log`. Server keys stay server-only.
6. Diff: review `git diff --stat` plus the changed files for unintended edits, missing error handling, and faked Meta/backend results.

Report one verdict line per gate plus blockers only, ending with READY or NOT READY. Quote real command output; never claim a gate passed without running it.
