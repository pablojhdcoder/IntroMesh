---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
license: MIT
---

# Writing Skills

Author skills for this repo's dual layout: every skill lives twice with identical text.

## Layout

- `.opencode/skills/<id>/SKILL.md` and `.cursor/skills/<id>/SKILL.md` — byte-identical bodies.
- Frontmatter: `name` (display label), `description` (one line: what it does + "Use when ..."), `license`. Keep the OpenCode v2 and Cursor formats compatible: plain `name`/`description` keys only.
- ID is the directory name: lowercase kebab-case, matching the directory (`ui-styling` lives in `ui-styling/`).
- Supporting files (`references/`, `scripts/`, `data/`) sit beside `SKILL.md` and are copied to both sides too.

## Content rules

- English, like the rest of the repo. Under ~80 lines for hand-written skills.
- Reference real paths (`src/server/`, `src/domain/`) and real scripts (`npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run verify:meta`).
- Never contradict `AGENTS.md` or `.cursor/rules/*.mdc`. No secrets, no installs without asking, no `git push`.
- One skill, one job. If two sources cover the same ground, merge into one instead of competing.

## Verify before done

- Load it via `@<id>` and run it against a real task; fix what the trial exposes.
- Confirm both copies are identical (`diff` the two `SKILL.md` files).
- New agent-side capabilities also need an entry in `AGENTS.md` (skills list) to be discoverable.
