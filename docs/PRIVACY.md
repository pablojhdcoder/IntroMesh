# Privacy — IntroMesh

## Consent

Joining an event makes you visible to its other members. There are no online/offline states: membership is visibility. Leave at any time to disappear from that event immediately — leaving sets the participation to `status = "left"` and removes your recommendations there. Closing the tab changes nothing; leaving is the only switch.

Accepting a connection is independent of being visible. Seeing a recommendation does not create a relationship.

## Minimization

Only what the event needs is stored: visible name, goal, interests, and skills the person declares. Sensitive attributes (health, origin, religion, orientation, economic status) are not inferred for matching. Those fields do not enter the prompt even if they appear in free-form bio text: they are removed before calling the model.

There is no continuous location tracking.

Canonical profile text (the same global/context fields used for matching) is sent to Azure OpenAI (`text-embedding-3-small`) to compute embeddings. Exposure level is the same as Meta: server-side HTTPS call, no secrets in the payload, no free-form notes or contact details.

## Public and private

| Public at the event (members only) | Private |
| --- | --- |
| Visible name, goal, declared interests and skills | Personal contact, notes, rejections, unsent introduction drafts |
| Connection path (link or QR) | Keys, internal identifiers, service role |

Organizers see membership: registered members and mutual connections. They do not see non-members or the content of introductions.

## Server and secrets

`MODEL_API_KEY`, `AZURE_OPENAI_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are read only on the server. They do not use the `NEXT_PUBLIC_` prefix. They are not written to logs, client error responses, or the repository.

Meta logs may include HTTP status, error type, and latency. They do not include the prompt, the profile, or the key. The same applies to Azure OpenAI embedding calls: no profile text, key, or endpoint secrets in logs.

## Sharing

Sharing is client-only: copy link, QR image, and vCard download. Nothing is recorded or aggregated.

## Profile visibility

`profiles.profile_visibility` (`public` | `private`) controls only the public username page `/u/[username]`. `public` exposes the SharedCard fields and nothing else (see `GLOBAL_IDENTITY.md`): never the original description, per-event intents, or event memberships. `private` returns no card. The avatar is optional and changes nothing about exposure.

## Membership is not public, and join is consent

Joining an event is not published. Which events a person joined never appears on a public card or in discovery at another event.

Joining an event is visibility at that event: `event_participations.status = joined` means the person appears in that event's discovery. Consent at one event says nothing at any other event.

## Switch vs leave

Switching events is only navigation: every membership stays `joined`, so the person can return without re-joining.

Leaving an event is stronger: it sets the participation to `status = "left"` and removes that event's recommendations involving the person. The person disappears from that event from that moment. Identity, other events, and accepted connections are untouched.

## Demo

Synthetic data carries the `demo` mark in the model and a “Demo” label in the UI. It is not presented as real attendees or as model output.
