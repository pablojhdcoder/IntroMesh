# Profile intelligence

Muse Spark (`muse-spark-1.3`, Responses API, `text.format`) turns free-form description into a Zod identity. The prompt lives in `NORMALIZE_PROMPT`.

It is called only if there is no generation with the same SHA-256, or if the person asks to regenerate. Entering the app or another event does not call the model.

| Version | Where |
| --- | --- |
| Original description | `global_identities.original_description` |
| Generated / confirmed | `global_identities.generated` / `confirmed` |

Editing a structured field saves the person’s version and does not resend the profile to Meta. Changing the original description can request another normalization.

Lists are checked against the source text. Unsupported items are cleared. Sensitive attributes are not inferred: those phrases are removed before the prompt.

Without `MODEL_API_KEY` the route answers that Meta is unavailable. A fabricated profile is not presented as model output. The person can fill fields by hand.

Projection into the profile the graph already consumes is in `toProfileInput`. A missing role becomes `Participant`, not an invented profession.
