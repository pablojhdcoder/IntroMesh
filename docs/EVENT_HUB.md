# Event hub — IntroMesh

The active event lives in the URL: `/events/[eventId]`. No “current event” is stored in the session or the identity.

## `/events`

| Section | Content |
| --- | --- |
| My Events | Events where this identity has an `event_participations` row with `status = joined` |
| Discover | Live events the person has not joined. Ended events are hidden |

Joining from Discover, an invite code, or an invite link asks for one per-event thing only: optional intent for this event (`event_participations.intent_text`).

Joining writes or updates the one `(user_id, event_id)` participation and bumps its `revision`. Joining never calls Meta, never re-normalizes the identity, and does not change `profiles` or other events' participations. Intent may enqueue that event's context embedding; the global embedding is reused. Joining is visibility: every joined member sees every other joined member.

## Invite code and link

- A code or link resolves through the existing event resolution (`POST /api/events`, `resolveEvent`): match on event `code` or `id`, case-insensitive.
- Ended or unknown events do not join. No event is invented from a code.
- Resolving an invite is not joining. The person still confirms intent and consent on the join step.

## Three different exits

These are not interchangeable:

| Action | Effect |
| --- | --- |
| Back to Events | Navigation to `/events` only. No API write: membership is unchanged |
| Switch Event | Navigation to the other `/events/[eventId]`. Membership stays `joined` at both events; nothing is modified |
| Leave Event | Explicit participation action (`POST /api/participation`, `action: "leave"`). Sets `status = "left"` and removes that event's recommendations involving the person |

Leaving hides the person at that event immediately. It does not delete the global identity, other participations, or accepted connections. Rejoining is a fresh join with new intent.

## Per-event state

Everything below is read from the participation for the `eventId` in the URL — never from a global “active event” field:

- Intent, status, and `revision`: `event_participations`.
- Recommendations: `event_match_recommendations` for that `event_id` only.
