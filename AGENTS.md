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

## Conventions

- App Router, strict TypeScript, Tailwind 4, shadcn/ui, Motion, Lucide, Zod, Supabase, OpenAI SDK against `https://api.meta.ai/v1`.
- UI in `src/app` and `src/components`. Use cases in `src/server`. Domain in `src/domain`. Meta in `src/lib/meta`. Supabase in `src/lib/supabase`.
- The lead agent defines contracts and order. Delegate UI to `ui-design-engineer`, matching and Meta to `meta-ai-matching-engineer`, and review to `qa-privacy-reviewer` (read-only). Do not assign the same file to two agents at once.
- Project skills: `impeccable`, `emil-design-eng`, `ui-quality-review`, `meta-model-api`.
- Product-facing copy is English for the Meta hackathon.

## Checks

`npm test`, `npm run lint`, and, only with `MODEL_API_KEY` in `.env.local`, `npm run verify:meta`. An unverified call is not declared successful.
