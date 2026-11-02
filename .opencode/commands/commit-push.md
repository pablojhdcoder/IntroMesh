---
description: Verify, split by theme, and commit + push with short one-idea commits
---

Commit and push the current work ($ARGUMENTS; default scope is the whole tree):

1. Verify first: run `npm test` and `npm run lint` (plus `npx tsc --noEmit` if TS changed). Stop on failure; suggest `/build-fix`.
2. Review `git status --short` and `git diff --stat`. Split the tree by idea, not by file: one theme and one responsibility per commit. Never mix features, fixes, refactors, docs, or tooling in a single commit.
3. Stage per idea (`git add <paths>`). Never stage `.env`, `.env.local`, keys, `.data/`, `node_modules/`, or `.next/`.
4. Message format from `.cursor/rules/commits.mdc`: `type(module): short subject`, English, imperative, max 72 chars (aim under 50). Modules: `onboarding`, `discovery`, `affinity`, `connect`, `learn`, `backend`; omit the module when the idea spans areas. No `update`, bare `fix`, `wip`, or empty subjects. No AI-tool mentions.
5. Push the current branch only: `git push origin HEAD`. Never `--force` (use `--force-with-lease` only if the user explicitly asks).
