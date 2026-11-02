---
name: motion-patterns
description: Production-ready animation patterns for React / Next.js — button, modal, toast, stagger, page transitions, exit animations, scroll, and layout — built on motion-foundations tokens and springs. Use when animating a specific UI element in React or Next.js — button, modal, toast, stagger, page transition, or scroll.
---

Motion animation for IntroMesh, built on the `motion` package plus tokens from `docs/DESIGN.md`. Keep animation subtle; the signal loop UI stays calm.

- Animate toasts, modals, and staggered list entrances; do not animate everything.
- Mount conditional UI (modals, toasts, sheets) in `AnimatePresence` with a `key`, and always define `exit` alongside enter.
- Page transitions use `mode="wait"`; scroll reveals use `viewport={{ once: true }}`.
- Stagger entrances at 0.05-0.10s; avoid `layout` on large subtrees — animate explicit `x`/`y` instead.
- Modals need dialog roles, `Esc` to close, focus trap, and scroll lock.
- Respect `prefers-reduced-motion`: provide a still alternative for every animation.
