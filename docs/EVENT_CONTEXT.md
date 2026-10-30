# Event context

Global identity and event context stay separate.

| Global, reusable | Per participation |
| --- | --- |
| Role, bio, interests, skills, projects, offer, focus, topics | Event, free-form intent, visibility, consent, status |

Leaving visibility — the existing Invisible control — sets consent to false and hides the person at that event. It does not turn off their identity or recommendations at other events.

Digital presence is still not physical proximity. QR, link, and NFC do not change. NFC only appears where the browser exposes `NDEFReader` in a secure context.

Embeddings and explanations are not public. RLS is on for the new tables and there is no policy for the anonymous role: only the server, with the service role, reads them. `MODEL_API_KEY` does not leave the server.

Joining an event does not call Meta. Only missing embeddings are scheduled and that viewer’s recommendations are recalculated.
