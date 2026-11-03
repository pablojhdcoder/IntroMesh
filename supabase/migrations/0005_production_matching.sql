-- Production matching: hot-path indexes + server-side candidate retrieval.
-- Idempotent: safe to re-apply. Vectors stay server-side; the HNSW indexes
-- from 0003_intelligence.sql are reused, never re-created here.

create index if not exists presence_event_expiry_idx
  on presence (event_id, expires_at);

create index if not exists event_match_recommendations_viewer_score_idx
  on event_match_recommendations (event_id, viewer_id, final_score desc);

create index if not exists profile_embeddings_status_lease_idx
  on profile_embeddings (status, lease_until);

create index if not exists event_context_embeddings_status_lease_idx
  on event_context_embeddings (status, lease_until);

-- Top-N global-vector neighbours restricted to joined members of the
-- given events. The write path (embedding worker) calls this instead of
-- loading every vector; the read path never calls it.
create or replace function match_candidates_by_embedding(
  viewer_embedding vector,
  event_ids text[],
  limit_n int
)
returns table (user_id text, distance double precision)
language sql stable
set search_path = public, extensions
as $$
  select pe.user_id, (pe.embedding <=> viewer_embedding)::double precision as distance
  from profile_embeddings pe
  join event_participations ep on ep.user_id = pe.user_id
  where pe.status = 'completed'
    and pe.embedding is not null
    and ep.event_id = any(event_ids)
    and ep.status = 'joined'
  order by pe.embedding <=> viewer_embedding
  limit greatest(limit_n, 1)
$$;
