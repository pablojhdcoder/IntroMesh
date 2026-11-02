---
name: nextjs-turbopack
description: Next.js 16+ and Turbopack guidance — incremental Rust bundling, file-system caching, faster dev startup and HMR, Turbopack vs webpack tradeoffs, and the middleware.ts to proxy.ts filename change. Use when developing or debugging Next.js 16+ apps, diagnosing slow dev startup or hot reload, choosing between bundlers, or reviewing middleware/proxy file naming.
---

Next.js 16 (this repo runs 16.4.3) uses Turbopack by default.

- `next dev` runs on Turbopack; only fall back to `--webpack` for a confirmed Turbopack bug or a webpack-only plugin.
- The file-system cache lives under `.next`; do not wipe it to fix slow dev startup — check the page graph and imports first.
- Next 16 renamed `middleware.ts` to `proxy.ts`; never "fix" the name back.
- Prefer App Router plus Server Components; keep client components small and low in the tree.
- For production bloat, use the Bundle Analyzer (16.1+) before guessing.
- Hydration errors mean server and client rendered different HTML: check dates, locales, random values, and browser-only APIs without guards.
