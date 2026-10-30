# Architecture — IntroMesh

Single loop: **Discover → Understand → Connect → Learn.**

This document sets the hackathon boundaries. The journey is already in the app. Meta only explains a recommendation that was already chosen.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| UI | `src/app`, `src/components` (`onboarding/`, `signal/`, `share/`) | Screens and signal field. Does not call Meta or read secrets |
| Use cases | `src/server` | Registration, presence, discovery, explanation, connection, and analytics |
| Domain | `src/domain` | Profile, presence, scoring, and vectors. No network or disk |
| Persistence | `src/lib/store`, `src/lib/supabase` | Supabase Postgres via service role on the server. Contract type is `Store` |
| Session | `src/lib/session` | Signed profile cookie. Does not talk to Meta |
| Meta | `src/lib/meta` | Client, schemas, errors, and a local request limit |
| Embeddings I/O | `src/lib/embedding` | Local E5 runtime. Pure math stays in `src/domain/embedding` |

Read the code in product order: `session` → `presence` → `discover` → `explain` → `connect` → `learn`.

Client components import prepared types and data. Route Handlers and Server Actions are the only edge that talks to privileged Supabase or Meta.

## Planned data

- Contextual profile: what the person chooses to show at an event.
- Voluntary presence: digital session at an event, with explicit consent.
- Discovery: attendees visible in that session.
- Matching: declared goals, interests, and skills.
- Explanation: structured Meta text only for recommendations that already passed the filter.
- Introduction: personalized draft, sent only if both sides accept.
- Connection: mutual agreement.
- Link, QR, and NFC as transport for the same public identifier.
- Organizer analytics: aggregates, no private profiles.

## Presence and proximity

Supabase Realtime Presence fits digital presence: who is visible in the event session. It does not measure physical distance.

There is no automatic phone-to-phone detection. Web NFC exists in Chrome for Android and not in Safari or most desktop browsers. NFC is progressive enhancement. QR and link cover the same flow when NFC is unavailable.

Precise continuous location is not collected.

## Matching at scale

There are two channels. The signal field still projects the neighborhood with feature hashing in `src/domain/embedding/vector.ts` so the approved layout does not move. The newer compatibility lives in `src/domain/matching/hybrid.ts` and in `docs/EMBEDDING.md`, `docs/MATCHING.md`, and `docs/META_AI_CACHE.md`.

Profiles are not compared all-to-all.

1. Index filter attributes: event, goals, interests, and skills.
2. Require presence at the event. The room is already the reduced set.
3. Project each visible profile to a local vector (`src/domain/embedding`). The text is the goal, interests, skills, and what they seek. Weights are `MATCH_WEIGHTS`. Closeness is cosine.
4. Keep a small neighborhood by that cosine. That places the field: closer to “You” means more alike. Angle comes from the vector, not from an index or randomness.
5. Score in code, with the formula below, only inside that room. A neighbor with no overlap is not a recommendation and gets no thread.
6. Ask Meta for an explanation only for recommendations that will be shown.

Meta Model API does not document an embeddings endpoint. The vector does not come from that API or another provider: it is deterministic feature hashing and is recomputed. It is not persisted. If official embeddings appear later, replace `embedProfile` and optionally store the vector; retrieval and the map keep the same contract. The signal field draws that neighborhood.

## Meta Model API

- Base URL: `https://api.meta.ai/v1`
- Text model: `muse-spark-1.3`
- SDK: `openai`, with explicit `baseURL` and `apiKey`. The SDK does not read `MODEL_API_KEY` on its own.
- Surface: Responses API (`client.responses.create`).
- Structured output: `text.format` with `type: "json_schema"`. On Responses, `response_format` does not configure output and can return HTTP 400.
- The client lives on the server (`server-only`). Timeout 25s. The SDK retries 429 and 5xx up to 2 times. An extra local limit prevents bursts.
- Model responses are validated with Zod. If they do not fit, that is an error, not an invented result.

## Matching formula

Over the set already filtered by event and live presence:

`score = goals×3 + interests×2 + skills×1 + complements×2`

A complement is a skill the other has that appears in what you are looking for and is not already a shared skill. Confidence is low with fewer than two signals, medium with two or three, high with four or more. Weights live in `MATCH_WEIGHTS`.

No all-pairs matrix is built. Meta only explains a candidate already scored, and the result is cached. A `demo` profile does not call Meta: the explanation is built from declared data and labeled as demo.

## Persistence in this hackathon

The server requires Supabase (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Apply `supabase/migrations/0001_init.sql` through `0004_store_parity.sql` (see `supabase/APPLY.md`). Session presence expires after 90 seconds without a heartbeat. Presence marked `demo` is a labeled fixture, not a phone in the room.

## Supabase

Public variables, protected by RLS: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Server secret: `SUPABASE_SERVICE_ROLE_KEY`. Never on the client or in `NEXT_PUBLIC_*`.

Without keys the app refuses to boot the data layer. Apply the migrations before the first join.

## Demo mode

`INTROMESH_DATA_MODE=demo` allows synthetic data labeled in the UI. It does not stand in for a model response. An AI explanation appears only after a real validated call.
