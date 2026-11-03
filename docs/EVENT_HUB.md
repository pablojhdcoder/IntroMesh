# Event hub — IntroMesh

Status: target routes for the multi-event hub. The active event lives in the URL: `/events/[eventId]`. No “current event” is stored in the session or the identity.

## `/events`

| Section | Content |
| --- | --- |
| My Events | Events where this identity has an `event_participations` row with `status = joined` |
| Discover | Live events the person has not joined. Ended events are hidden |

Joining from Discover, an invite code, or an invite link asks for two per-event things only:

1. Optional intent for this event (`event_participations.intent_text`).
2. Consent to be discoverable at this event (`consent`, `visibility`).

Joining writes or updates the one `(user_id, event_id)` participation, bumps its `revision`, and — only with consent — starts session presence. Joining never calls Meta, never re-normalizes the identity, and does not change `profiles` or other events' participations. Intent may enqueue that event's context embedding; the global embedding is reused.

## Invite code and link

- A code or link resolves through the existing event resolution (`POST /api/events`, `resolveEvent`): match on event `code` or `id`, case-insensitive.
- Ended or unknown events do not join. No event is invented from a code.
- Resolving an invite is not joining. The person still confirms intent and consent on the join step.

## Three different exits

These are not interchangeable:

| Action | Effect |
| --- | --- |
| Back to Events | Navigation to `/events` only. No API write: membership, consent, and visibility are unchanged. If heartbeats stop, live presence expires on its own after 90s |
| Switch Event | Navigates to the other `/events/[eventId]`. The heartbeat stops for the previous event, so its live presence lapses within the 90s TTL. Membership stays `joined` at both events; no participation is modified |
| Leave Event | Explicit participation action (`POST /api/participation`, `action: "leave"`). Sets `status = left`, `consent = false`, `visibility = hidden`, and removes session presence for that event |

Leaving hides the person at that event immediately. It does not delete the global identity, other participations, or accepted connections. Rejoining is a fresh join with new intent and consent.

## Per-event state

Everything below is read from the participation and presence for the `eventId` in the URL — never from a global “active event” field:

- Intent, consent, visibility, status, and `revision`: `event_participations`.
- Live presence: `presence` rows for `(profile_id, event_id)`, session source, 90s expiry.
- Recommendations: `event_match_recommendations` for that `event_id` only.
