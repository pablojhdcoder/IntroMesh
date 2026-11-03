# Embeddings

Where this sits in the journey: [`FLOW.md`](FLOW.md) §2–§3. Join and confirm enqueue jobs; inline `after()` processing is the embedder and the writer of recommendations.

Provider: Azure OpenAI `text-embedding-3-small`, native 1536 dimensions over HTTPS. No `query:` prefix, no local runtime.

```mermaid
flowchart TD
  confirmed[Confirmed identity] --> globalText[Canonical global text]
  intent[Event intent] --> contextText[Canonical context text]
  globalText --> queue[Job queue]
  contextText --> queue
  queue --> inline[after() inline process after confirm/join]
  inline --> store[Completed vectors]
  inline --> recs[Top-8 recommendations]
```

- `event_context_embeddings`: one vector per person and event.
- Not regenerated if hash, revision, and `completed` status still hold.
- A two-minute lease recovers abandoned work. At most three attempts.

Global text includes role, summary, interests, skills, projects, offer, focus, and topics. Contextual text includes intent, what they seek, and event metadata. No secrets.

In this repository the queue persists in the store. Confirm and join enqueue, then the server processes the jobs inline with `after()` after the response — no separate always-on service is required. The scripts `npm run worker:embeddings` and `npm run backfill:embeddings` are backfill/retry tools run from a laptop, not deploy targets. The pgvector HNSW index and RPC are in `supabase/migrations/0006_azure_embeddings_1536.sql`, which alters columns to `vector(1536)` and resets stale-provider rows to pending. Until it is applied, viewer search is brute force over event attendees, not over every pair.

Seed demo profiles (no identities or participations) are excluded from embedding scope. They still appear in the discovery directory via presence.

Vectors are never read by discovery or affinity. Discovery serves persisted rows; affinity explains one persisted row using its stored evidence labels.
