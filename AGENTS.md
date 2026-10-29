<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# IntroMesh

Plataforma de networking presencial. Hilo: Discover → Understand → Connect → Learn.

La regla siempre activa está en `.cursor/rules/intromesh.mdc`. Estos documentos son la fuente de detalle:

- `DESIGN.md` — The Signal Loop. Obligatorio para UI.
- `ARCHITECTURE.md` — capas, presencia, matching y Meta.
- `PRIVACY.md` — consentimiento, minimización y analítica.

## Convenciones

- App Router, TypeScript estricto, Tailwind 4, shadcn/ui, Motion, Lucide, Zod, Supabase, OpenAI SDK contra `https://api.meta.ai/v1`.
- UI en `src/components`. Dominio en `src/domain`. Meta en `src/lib/meta`. Supabase en `src/lib/supabase`.
- El agente principal define contratos y el orden. Delega UI a `ui-design-engineer`, matching y Meta a `meta-ai-matching-engineer`, y la revisión a `qa-privacy-reviewer` (solo lectura). No encargues el mismo archivo a dos agentes a la vez.
- Skills de proyecto: `impeccable`, `emil-design-eng`, `ui-quality-review`, `meta-model-api`.

## Comprobaciones

`npm test`, `npm run lint` y, solo con `MODEL_API_KEY` en `.env.local`, `npm run verify:meta`. Una llamada no verificada no se declara exitosa.
