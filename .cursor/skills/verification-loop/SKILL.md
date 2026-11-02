---
name: verification-loop
description: Run a six-phase verification of session work — build, typecheck, lint, tests with coverage, security grep, and diff review — then produce a PASS/FAIL verification report. Use when verifying work after completing a feature or refactor, before creating a PR, or when quality gates must pass.
---

Run the gates in order; stop the loop on a build or type failure.

1. Build: `npm run build`. Stop on failure.
2. Types: `npx tsc --noEmit`. Fix criticals before continuing.
3. Lint: `npm run lint`. Report warnings.
4. Tests: `npm test` (Vitest). Report passed/total; coverage is a spot check, not a gate (`npx vitest run --coverage` only if the provider is installed).
5. Security: search `src/` for hardcoded keys (`sk-`, `api_key`, service-role values), secrets in `NEXT_PUBLIC_*`, and stray `console.log`. `MODEL_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` stay server-only; discovery needs consent.
6. Diff: review `git diff --stat` plus the changed files for unintended edits, missing error handling, and faked Meta/backend results.

Emit one verdict line per gate plus blockers only, ending with READY or NOT READY. Quote real command output; never claim a gate passed without running it.

## Evidence gate

No success claims without fresh command output. Re-run every gate after each fix; stale output from before the fix does not count. A gate passes only when its command ran green in the current state of the working tree.
