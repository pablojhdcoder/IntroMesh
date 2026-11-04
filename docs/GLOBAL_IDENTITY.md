# Global identity — IntroMesh

One person, one global identity. Events add participations; they do not create new identities.

Status: implemented in migration `0007`. Existing tables keep their names; do not rename them.

## Identity

| Piece | Where | Rule |
| --- | --- | --- |
| Person | `profiles.id` | Session cookie `userId` is this profile id |
| Username | `profiles.slug` | Unique (`0001`). It is the public username in `/u/[username]` |
| Free-form source | `global_identities.original_description` | Private. Never on a public card |
| Model draft | `global_identities.generated` | Separate from what the person confirms |
| Person's version | `global_identities.confirmed` | Separate; editing it does not call Meta |
| Optional avatar | `profiles.avatar_url` (nullable, `0007`) | Optional. No avatar is required to join, be discovered, or connect |

`global_identities.user_id` is the `profiles.id`. There is no second account per event.

## Normalize once

Muse Spark (`muse-spark-1.3`) normalizes the original description into the generated draft, with structured output validated in code.

- SHA-256 of the trimmed description is `global_identities.input_hash`.
- Same hash → reuse the stored generation (`source: "cache"`). No new Meta call.
- New description, or an explicit regenerate, may call Meta once for that hash.
- Opening the app, opening `/events`, or joining another event never calls Meta for normalization.
- Without `MODEL_API_KEY`, no generated text is invented; the person edits fields by hand.
- Meta does not rank people. Ranking stays deterministic in code (see `MATCHING.md`).

## Public or private

`profiles.profile_visibility` (`public` | `private`, added by `0007`) controls the public username page only. It does not replace per-event discovery consent.

| `public` | `private` |
| --- | --- |
| `/u/[username]` returns the SharedCard fields only | `/u/[username]` returns no card |
| Link, QR, and vCard may carry that URL | The owner can still use IntroMesh and join events |

SharedCard fields only (`src/domain/profile.ts`): `id`, `slug`, `displayName`, `role`, `interests`, `skills`, `projects`, `goal`, `demo`, `presentation`, plus the optional avatar if set.

Never public, in either setting:

- `global_identities.original_description`
- Generated or confirmed identity JSON beyond the projected SharedCard fields
- Per-event intent (`event_participations.intent_text`)
- Event memberships — which events a person joined
- Presence, recommendations, explanations, intro text, or contact details

Event discovery is separate: a `public` profile is not discoverable at an event unless that event's participation has consent and `visibility = discoverable` (see `EVENT_HUB.md`, `PRIVACY.md`).
