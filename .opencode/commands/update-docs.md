---
description: Sync README and docs from the code (scripts, env, routes) in the current session
---

Sync the docs with the code for: $ARGUMENTS

1. Find what changed: `git diff --name-only`.
2. Map each change to `README.md`, `docs/*.md`, route-handler docs, or JSDoc.
3. Update from code truth only: `package.json` scripts table, `.env.example` variables (never real values), routes and exports, examples and links. Never promise features that do not exist.
4. Verify: README scripts still run, examples are valid, links resolve, product copy stays English.

Report which files changed and which stayed current. Never stage or commit; suggest `/checkpoint` instead.
