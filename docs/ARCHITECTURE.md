# Architecture — IntroMesh

Single loop: **Discover → Understand → Connect → Learn.** The step-by-step journey is in [`FLOW.md`](FLOW.md). This file is layers and boundaries.

This document sets the hackathon boundaries. The journey is already in the app. Meta only explains a recommendation that was already chosen.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| UI | `src/app`, `src/components` (`onboarding/`, `signal/`, `share/`) | Screens and signal field. Does not call Meta or read secrets |
| Use cases | `src/server` | Registration, discovery, explanation, connection, and analytics |
| Domain | `src/domain` | Profile, scoring, and vectors. No network or disk |
| Persistence | `src/lib/store`, `src/lib/supabase` | Supabase Postgres via service role on the server. Contract type is `Store` |
| Session | `src/lib/session` | Signed profile cookie. Does not talk to Meta |
| Meta | `src/lib/meta` | Client, schemas, errors, and a local request limit |
| Embeddings I/O | `src/lib/embedding` | Azure OpenAI `text-embedding-3-small` (1536 dims) over HTTPS, processed inline with `after()`. Pure math stays in `src/domain/embedding` |

Read the code in product order: `session` → `discover` → `explain` → `connect` → `learn`.

Client components import prepared types and data. Route Handlers and Server Actions are the only edge that talks to privileged Supabase or Meta.

## Planned data

- Contextual profile: what the person chooses to show at an event.
- Membership: joining an event makes the member visible to the other members. No online states.
- Discovery: registered attendees of that event.
- Matching: declared goals, interests, and skills.
- Explanation: structured Meta text only for recommendations that already passed the filter.
- Introduction: personalized draft, sent only if both sides accept.
- Connection: mutual agreement.
- Link, QR, and vCard as transport for the same public identifier.
- Organizer analytics: aggregates, no private profiles.

## Visibility, not proximity

Who is visible is membership: every `joined` participation at an event sees every other. There is no online/offline tracking and no expiring session.

There is no automatic phone-to-phone detection. Sharing travels by link, QR, and vCard on every device.

Precise continuous location is not collected.

## Matching at scale

There are two jobs with one owner. Inline `after()` processing after confirm/join is the writer of recommendations: it embeds the enqueued global/event texts via Azure OpenAI, then recomputes the affected viewer lists. The discovery read path never embeds, scores, or reads vectors. `npm run worker:embeddings` and `npm run backfill:embeddings` are laptop backfill/retry tools, not a required deploy service. Details live in `docs/EMBEDDING.md`, `docs/MATCHING.md`, and `docs/META_AI_CACHE.md`.

Profiles are not compared all-to-all.

1. Index filter attributes: event, goals, interests, and skills.
2. Require a `joined` participation at the event. The room is already the reduced set.
3. Retrieve at most 24 by global embedding similarity (pgvector HNSW in production, brute force in the memory store).
4. If both sides have a context embedding, it enters the semantic blend: 35% global and 65% contextual.
5. Score in code with the hybrid formula, only inside that event. A neighbor below the cutoff is not a recommendation.
6. Persist at most 8 per viewer in `event_match_recommendations` with stored evidence labels (shared goals/interests/skills, complements).
7. Ask Meta for an explanation only for persisted recommendations that will be shown.

The signal field draws the persisted neighborhood at deterministic hash positions (`pointForPair`); closer to “You” is layout only, not a score claim.

## Meta Model API

- Base URL: `https://api.meta.ai/v1`
- Text model: `muse-spark-1.3`
- SDK: `openai`, with explicit `baseURL` and `apiKey`. The SDK does not read `MODEL_API_KEY` on its own.
- Surface: Responses API (`client.responses.create`).
- Structured output: `text.format` with `type: "json_schema"`. On Responses, `response_format` does not configure output and can return HTTP 400.
- The client lives on the server (`server-only`). Timeout 25s. The SDK retries 429 and 5xx up to 2 times. An extra local limit prevents bursts.
- Model responses are validated with Zod. If they do not fit, that is an error, not an invented result.

## Matching formula

Over the set already filtered by event and membership:

`score = goals×3 + interests×2 + skills×1 + complements×2`

A complement is a skill the other has that appears in what you are looking for and is not already a shared skill. Confidence is low with fewer than two signals, medium with two or three, high with four or more. Weights live in `MATCH_WEIGHTS`.

No all-pairs matrix is built. Meta only explains a persisted recommendation, and the result is cached. The `demo` badge marks a fixture profile in the UI only; it changes no matching, explanation, or connection behavior.

## Persistence in this hackathon

The server requires Supabase (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Apply `supabase/migrations/0001_init.sql` through `0009_membership_visibility.sql` (see `supabase/APPLY.md`). There is no presence table and no heartbeat: visibility is the `joined` participation. Embedding jobs are processed inline with `after()`; the worker scripts are backfill/retry tools only.

## Supabase

Public variables, protected by RLS: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Server secret: `SUPABASE_SERVICE_ROLE_KEY`. Never on the client or in `NEXT_PUBLIC_*`.

Without keys the app refuses to boot the data layer. Apply the migrations before the first join.

## Demo mode

`INTROMESH_DATA_MODE=demo` allows synthetic data labeled in the UI. It does not stand in for a model response. An AI explanation appears only after a real validated call.
