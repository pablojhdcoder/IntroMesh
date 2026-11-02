---
name: executing-plans
description: Use when executing an implementation plan in the current session as the implementer yourself — your human partner chose inline execution, or no subagent tool is available
license: MIT
---

# Executing Plans (Inline, Solo Dev)

Execute the plan yourself, task by task, in this session. No subagents,
no per-task reviewers. One fresh review pass over the whole change at the end.

**Plan is law.** The plan already did the thinking. Follow its steps in
order. If a step conflicts with the repo (`src/`, `docs/`, scripts), the
plan still wins unless it is unworkable — then record a ruling and keep moving.

## Setup

1. Read the plan once, plus any spec it names. Note global constraints.
2. Keep a small manual ledger (todo list or short checklist file):
   `- [ ] Task N — <one-liner>` / `- [x] Task N — done (tests: <command> → pass)`.
3. Never start on `main`/`master` without explicit approval.

## Task Loop

For each task, in order:

1. **Read the task brief.** Use exact values, signatures, and test cases. Do not rely on memory.
2. **TDD gate (mandatory).** Write the failing Vitest test first, run `npm test`, and watch it fail. A test that passes before the implementation exists is a finding about the test, not proof.
3. **Implement the minimum** that turns the test green. Follow repo conventions: App Router, strict TypeScript, Zod on external input, existing tokens/components.
4. **Verify the step.** Run the commands the task names (`npm test`, `npx tsc --noEmit`, `npm run lint` when touched). Read the output. Every `Expected:` line is compared against real output, not assumed.
5. **Mark the ledger.** One line per task: done plus the test command and result. If the code was wrong, debug the cause; never patch the symptom to match expected output.

## Rulings, Not Stalls

Conflicts, ambiguities, plan defects — decide them and keep moving.
Record each as `Ruling: <decision> — <why> — <cost if wrong>`.
Unrecorded deviation is a decision made in secret. Stop and ask only for:
irreversible or destructive operations, security-sensitive actions, side
effects outside the worktree (merge, push, publish), or a plan so broken
every path forward is a guess.

## Final Pass

1. **One fresh review pass** over the whole diff (`git diff --stat` plus changed files) after the last task. Check for broken behavior, missing error handling, invented data, and secret leaks.
2. Fix critical/important findings one at a time, each RED→GREEN with a failing test first and a green suite after. Log minor polish as deferred, do not expand scope.
3. Run `/verify` (build + types + lint + tests + secret-grep + diff), then `/checkpoint` (tests + lint, then a commit proposal — never push).

## Rationalizations

| Excuse | Reality |
| --- | --- |
| "I remember the task" | Read the brief. Memory is a summary. |
| "Skip watching the test fail" | Unfailed tests prove nothing. Run it. |
| "Full suite at the end is enough" | Per-task runs localize breakage. |
| "Just do the right thing silently" | Ledger the ruling. |
| "Self-review is redundant" | Same author, same blind spots. Do the pass. |
| "Trivial change, skip tests" | "Should pass" is not output. Run it. |
