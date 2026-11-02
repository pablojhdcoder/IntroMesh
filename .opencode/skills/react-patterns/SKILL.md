---
name: react-patterns
description: React 18/19 patterns including hooks discipline, server/client component boundaries, Suspense + error boundaries, form actions, data fetching, state management decision trees, and accessibility-first composition. Use when writing or reviewing React components.
---

React 19 + Next.js App Router patterns for IntroMesh. Read `docs/DESIGN.md` first for tokens; build on shadcn/ui.

- Render is a pure function of props and state: derive during render, never keep derived state in `useEffect`.
- Side effects only in event handlers and `useEffect`, never in the render body. Hooks at the top level only; clean up subscriptions (`AbortController`); use the functional updater when new state depends on old state.
- Respect Server/Client boundaries: no server-only or DB imports in `"use client"` modules; no secrets or full user records in props.
- Wrap async UI in Suspense plus error boundaries; cover loading, empty, error, and success states in every screen.
- Compose with children and props; lift state only as high as needed; no prop drilling deeper than 3 levels.
- Never call the Meta Model API from client components; screens consume typed contracts from `src/server/`.
- Accessibility first: real `button` elements, labeled inputs, `alt` text, unskipped headings, `noopener noreferrer` on `target="_blank"`.

Check with `npm run lint` and `npx tsc --noEmit`.
