<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# IntroMesh

In-person networking platform. Loop: Discover → Understand → Connect → Learn.

The always-on rule is in `.cursor/rules/intromesh.mdc`. These documents are the detail source:

- `docs/DESIGN.md` — The Signal Loop. Required for UI.
- `docs/ARCHITECTURE.md` — layers, presence, matching, and Meta.
- `docs/PRIVACY.md` — consent, minimization, and analytics.
- `docs/PRODUCT.md` — product and audience.
- Deep dives in `docs/`: `EMBEDDING.md`, `MATCHING.md`, `META_AI_CACHE.md`, `ONBOARDING.md`, `EVENT_CONTEXT.md`, `PROFILE_INTELLIGENCE.md`.

## Conventions

- App Router, strict TypeScript, Tailwind 4, shadcn/ui, Motion, Lucide, Zod, Supabase, OpenAI SDK against `https://api.meta.ai/v1`.
- UI in `src/app` and `src/components` (`onboarding/`, `signal/`, `share/`, `ui/`). Use cases in `src/server`. Domain in `src/domain`. Persistence in `src/lib/store` and `src/lib/supabase`. Meta in `src/lib/meta`. Session cookies in `src/lib/session`.
- The lead agent defines contracts and order. Delegate UI to `ui-design-engineer`, matching and Meta to `meta-ai-matching-engineer`, and review to `qa-privacy-reviewer` (read-only). For high-level UI direction and design critique, use `vision-ui-director` (on demand). Run independent tasks as parallel subagents with small isolated briefs, then merge. Do not assign the same file to two agents at once.
- Project skills: `impeccable`, `emil-design-eng`, `ui-quality-review`, `meta-model-api`, `demo-pitch`, `tdd-workflow`, `verification-loop`, `typescript-patterns`, `react-patterns`, `react-testing`, `nextjs-turbopack`, `motion-patterns`, `security-review`, `strategic-compact`, `brainstorming`, `systematic-debugging`, `writing-plans`, `executing-plans`, `receiving-code-review`, `writing-skills`, `ui-styling`, `design-system`, `brand`, `archify`.
- Product-facing copy is English for the Meta hackathon.

## Checks

`npm test`, `npm run lint`, and, only with `MODEL_API_KEY` in `.env.local`, `npm run verify:meta`. An unverified call is not declared successful.

## OpenCode

OpenCode reads this file plus `.cursor/rules/*.mdc` (via `opencode.json` `instructions`). `.opencode/` and `.cursor/` each hold full, identical copies of agents, skills, and commands so either tool works standalone; keep both sides in sync when changing one.

- Subagents: `ui-design-engineer`, `vision-ui-director` (on demand), `meta-ai-matching-engineer`, `qa-privacy-reviewer` (read-only), `react-reviewer` (read-only), `supabase-reviewer` (read-only), `build-fixer` (minimal diffs), `tdd-guide` (RED-GREEN-REFACTOR), `planner` (read-only), `pitch` (only `docs/` and `README.md`).
- Commands: `/code-review`, `/build-fix`, `/checkpoint`, `/tdd`, `/plan`, `/verify`, `/test-coverage`, `/update-docs`.
- Plan before changes that touch more than two files. If the same error survives three attempts, stop and ask.
- Commits follow `.cursor/rules/commits.mdc`. Never push.
