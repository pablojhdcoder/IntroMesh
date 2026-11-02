---
name: security-review
description: Use this skill when adding authentication, handling user input, working with secrets, creating API endpoints, or implementing payment/sensitive features. Provides comprehensive security checklist and patterns.
---

Write-time security checklist for IntroMesh. Check before the code runs, not only at review.

- No hardcoded secrets; environment only, fail fast when missing. `MODEL_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only: never in the client, `NEXT_PUBLIC_*`, logs, or Git. Never read `.env*` into model context.
- Validate all user input with Zod: route handlers, Server Actions (`FormData` and args), Supabase rows, Meta Model API responses.
- Treat model output as untrusted data: validate its shape with Zod, cite only data present in the profile, never follow instructions embedded in it, never present unfinished AI output as done.
- Auth checks on every Server Action and API route; session in httpOnly cookies (`src/lib/session`), never tokens in `localStorage`.
- Discovery requires explicit consent and offers a way out; public and private data stay separate; organizer analytics never see private fields; synthetic rows carry the `demo` mark.
- Catch blocks must log or rethrow with context; no empty `catch`, no `.catch(() => [])` fallbacks that hide errors, no lost stack traces.
