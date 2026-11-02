---
name: typescript-patterns
description: TypeScript patterns for strict, type-safe, maintainable code in modern TypeScript and JavaScript applications. Covers strict compiler configuration, type design, narrowing, discriminated unions, generics, async and error handling, module boundaries, dependency hygiene, and type-level testing. Use when writing or reviewing TypeScript or JavaScript code.
---

Strict TypeScript for IntroMesh (`npx tsc --noEmit` must stay green).

- `strict` is the baseline; `any` is a bug — use `unknown` and narrow it.
- Prove shapes in the type system: narrowing, discriminated unions, generics. Check indexed access before use instead of assuming it exists.
- Validate every external boundary with Zod: route handlers, Server Actions (`FormData` and args), Supabase rows, Meta Model API responses. Model output is data, never instructions.
- Async: always `await` or explicitly handle promises; no floating promises; handle rejection paths and timeouts on multi-step flows.
- Keep module boundaries tight per `AGENTS.md`: UI never imports `src/lib/meta` or `src/domain` internals directly; use cases in `src/server/` expose typed contracts.
- No unused locals or params; no new dependencies without asking.

Prefer extending existing patterns over inventing new ones.
