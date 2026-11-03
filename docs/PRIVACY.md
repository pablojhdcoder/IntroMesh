# Privacy — IntroMesh

## Consent

Appearing in discovery is opt-in. The default is not visible. A person can leave visibility at any time; real-time presence must be withdrawn then, not when the tab closes.

Accepting a connection is independent of being visible. Seeing a recommendation does not create a relationship.

## Minimization

Only what the event needs is stored: visible name, goal, interests, and skills the person declares. Sensitive attributes (health, origin, religion, orientation, economic status) are not inferred for matching. Those fields do not enter the prompt even if they appear in free-form bio text: they are removed before calling the model.

There is no continuous location tracking.

Canonical profile text (the same global/context fields used for matching) is sent to Azure OpenAI (`text-embedding-3-small`) to compute embeddings. Exposure level is the same as Meta: server-side HTTPS call, no secrets in the payload, no free-form notes or contact details.

## Public and private

| Public at the event, with consent | Private |
| --- | --- |
| Visible name, goal, declared interests and skills | Personal contact, notes, rejections, unsent introduction drafts |
| Connection path (link or QR) | Keys, internal identifiers, service role |

Organizers see aggregated metrics: visible attendees, mutual connections, most-declared topics. They do not see profiles that did not consent or the content of introductions.

## Server and secrets

`MODEL_API_KEY`, `AZURE_OPENAI_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are read only on the server. They do not use the `NEXT_PUBLIC_` prefix. They are not written to logs, client error responses, or the repository.

Meta logs may include HTTP status, error type, and latency. They do not include the prompt, the profile, or the key. The same applies to Azure OpenAI embedding calls: no profile text, key, or endpoint secrets in logs.

## Analytics

Event aggregates only. No export of free-form profile text or messages. The `topic` field on analytics rows is a coarse aggregate label (the first declared interest at write time) used only for counts, never a person ranking.

## Demo

Synthetic data carries the `demo` mark in the model and a “Demo” label in the UI. It is not presented as real attendees or as model output.
