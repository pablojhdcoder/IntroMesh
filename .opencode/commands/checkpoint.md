---
description: Run tests and lint, then propose a commit that follows .cursor/rules/commits.mdc
---

Checkpoint the current work:
1. Run `npm test` and `npm run lint`. If either fails, stop and summarize (suggest /build-fix).
2. If they pass, propose a message in the `type(module): what changed and why` format from `.cursor/rules/commits.mdc` for: $ARGUMENTS
3. Ask me before `git add` and `git commit`. Never push. Never stage `.env*`, `.data/`, `.next/` or `node_modules/`.

!`git status --short`