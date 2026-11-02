---
description: Analyze Vitest coverage and generate the missing tests with the tdd-guide subagent
agent: tdd-guide
---

Analyze test coverage for: $ARGUMENTS (default: the changed files in `git diff --name-only`).

1. Run `npx vitest run --coverage` (if no coverage provider is installed, say so and fall back to `npm test` plus a manual gap list; never install anything without asking).
2. Tabulate per-file statement/branch/function/line percentages, worst first.
3. Prioritize gaps: auth/session, matching, and `src/domain` logic first; UI last.
4. Targets: 80% standard, 100% auth and secrets handling, 90% utils, 70% presentational UI. Coverage is a signal, not the goal.
5. Write the missing tests RED-first (`describe`/`it` skeletons with `src/path/file.ts:line`), then implement to green.

Report before/after numbers with real command output.
