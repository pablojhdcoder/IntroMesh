# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router), React, strict TypeScript, Tailwind CSS, shadcn/ui, Motion, Lucide, Zod, Supabase, and Meta Model API through the OpenAI SDK. The brief fixed this stack. Hackathon delivery is November 4, 2026.

## Users

Someone attending an in-person event who wants to discover who to talk to, understand why, and start a relationship. Organizers see only aggregated event metrics.

## Product Purpose

IntroMesh turns an in-person encounter into a deliberate connection. Success is an introduction accepted by both people, with a clear reason, without exposing anyone who did not consent to appear.

## Positioning

Discovery presence is voluntary and separate from physical proximity. Candidate filtering is deterministic; Meta Model API explains recommendations already chosen. The same public identifier travels by link, QR, and NFC when the browser allows it.

## Operating Context

A networking event, mostly from a phone. The person joins a session, chooses visibility, browses attendees, reads why to connect, and accepts or not. Organizers review aggregates at the end.

## Capabilities and Constraints

Confirmed: contextual profiles, voluntary real-time presence, discovery, matching by goals, interests, and skills, Meta explanations, introductions, mutual connections, link, QR, progressive NFC, and aggregated analytics.

Constraints: do not simulate model output; no Meta Model API embeddings (undocumented); no automatic physical phone detection; no continuous precise location; no inferred sensitive attributes.

Language: the product UI, prompts, and public docs are English for the Meta Global AI Developer Hackathon.

## Brand Commitments

Name: IntroMesh. The binding visual direction is in `docs/DESIGN.md` (The Signal Loop). Do not copy Linear, Vercel, or Apple UI.

## Evidence on Hand

No testimonials, customers, prices, or usage metrics. Do not invent them. Nodes in the initial view are a labeled demo, not attendees.

## Product Principles

- Nobody appears in discovery without consent, and they can leave.
- A recommendation without a concrete reason is not shown.
- What the model did not answer is not filled in.
- Mobile is the main scene at the event.
- Organizers do not receive private profiles or introduction text.

## Accessibility & Inclusion

Keyboard, visible focus, system contrast in `docs/DESIGN.md`, and respect for `prefers-reduced-motion`. The graph has a list alternative. Touch targets at least 44px.
