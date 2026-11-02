---
name: tdd-workflow
description: Test-driven development workflow: write a failing test first, watch it fail, implement the smallest change to green, then refactor with 80%+ coverage across unit, integration, and E2E tests. Use when writing a new feature, fixing a bug, refactoring, or when told to write failing tests first.
---

RED-GREEN-REFACTOR for IntroMesh. Tests run with `npm test` (Vitest), colocated as `*.test.ts` next to the code (`src/domain/*.test.ts`, `src/server/*.test.ts`, `src/components/**/*.test.ts`).

## RED

Write one failing test per behavior before any production code. Run it and confirm it fails for the right reason. Cover edge cases: null/undefined, empty, invalid types, boundaries, error paths.

## GREEN

Write the smallest change that passes. Mock external boundaries (Supabase clients in `src/lib/supabase/`, Meta Model API in `src/lib/meta/`) instead of calling them. Validate inputs and outputs with Zod.

## REFACTOR

Clean up with tests green, then re-run `npm test`, `npx tsc --noEmit`, `npm run lint`. One behavior per test, no shared state, no tests of internals, specific assertions.

Bug fixes start by reproducing the bug with a test. Synthetic fixtures carry the `demo` mark; never invent matches or model text. Coverage targets: 80% standard, 100% auth and secrets handling, 90% utils, 70% presentational UI.
