# Connections — IntroMesh

Connections are global and persistent. They outlive the event where the two people met.

## Record

Existing table `connections` (`0001`), no rename:

| Field | Meaning |
| --- | --- |
| `from_id` / `to_id` | Requester and recipient (`profiles.id`) |
| `event_id` | Origin event: the event where the request was made. Kept after that event ends or either person leaves it |
| `status` | `pending` → `accepted` or `declined` |
| `intro` / `intro_source` | Introduction text and its source (`model` \| `user`). Private to the two parties |
| `created_at` / `accepted_at` | Request and acceptance dates |

## Rules

- **Canonical pair.** One live record per unordered pair. A request in the reverse direction finds the same pair instead of creating a second row. Migration `0007` enforces this with a unique partial index over `(least(from_id, to_id), greatest(from_id, to_id))` where `status in ('pending', 'accepted')`. A `declined` record does not block a later request.
- **Accept is the recipient's alone.** Only `to_id` may accept or decline. The requester cannot accept their own request, and there is no simulated accept.
- **Independent of visibility.** Accepting does not require either person to be discoverable or present. Seeing a recommendation — or a public card — is not a relationship.
- **Private intro.** Intro text is shown only to `from_id` and `to_id`. It never appears on `/u/[username]`, in discovery, or in organizer aggregates.
- **Survives events.** Leaving, switching, or the event ending does not delete or change a connection.

## Connections page

The connections page lists accepted connections across all events, not just the event in the current URL. Each entry shows:

- The other person's SharedCard fields, with the `demo` mark when present.
- The origin event (name resolved from `event_id`) and the connection date.
- A link to their public card, only if their profile is `public`.

## Non-goals

- No feed, no timeline, no activity stream.
- No messaging or chat. IntroMesh records the mutual connection and the introduction; the conversation happens in person or elsewhere.
- No contact export. No email or phone is collected or shown.
