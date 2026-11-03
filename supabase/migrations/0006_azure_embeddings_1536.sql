-- Azure OpenAI text-embedding-3-small, native 1536 dims.
-- Idempotent: safe to re-apply. Replaces the 384-dim legacy columns from
-- 0003_intelligence.sql (1536 < pgvector HNSW max 2000, so HNSW stays).
--
-- Old 384-dim rows are INVALID under the new provider and must be
-- re-embedded; this migration only invalidates them (vectors nulled, jobs
-- reset to pending under the new model id/revision). It does NOT re-embed:
-- run `npm run backfill:embeddings` from a laptop with the AZURE_* env vars
-- (drains via the shared queue runner), or let the API inline path plus
-- `npm run worker:embeddings` pick up pending jobs.
-- Demo seeds (0002) carry no identities/participations and get no rows here;
-- they surface in discovery's directory via live presence, never via vectors.

-- Invalidate stale-provider rows while the old typmod still holds, so the
-- ALTER below never meets a 384-dim value.
update profile_embeddings
set embedding = null,
    model_id = 'text-embedding-3-small',
    model_revision = 'azure-te3small-1536-v1',
    status = 'pending',
    attempts = 0,
    lease_until = null,
    error = null,
    updated_at = now()
where model_id <> 'text-embedding-3-small' or model_revision <> 'azure-te3small-1536-v1';

update event_context_embeddings
set embedding = null,
    model_id = 'text-embedding-3-small',
    model_revision = 'azure-te3small-1536-v1',
    status = 'pending',
    attempts = 0,
    lease_until = null,
    error = null,
    updated_at = now()
where model_id <> 'text-embedding-3-small' or model_revision <> 'azure-te3small-1536-v1';

-- Belt-and-braces: null any leftover row whose stored dims are not 1536
-- (e.g. a partially-applied run), so the ALTER below never meets a
-- 384-dim value. `vector_dims` reads the typmod-independent length.
update profile_embeddings
set embedding = null,
    status = 'pending',
    attempts = 0,
    lease_until = null,
    error = null,
    updated_at = now()
where embedding is not null and vector_dims(embedding) <> 1536;

update event_context_embeddings
set embedding = null,
    status = 'pending',
    attempts = 0,
    lease_until = null,
    error = null,
    updated_at = now()
where embedding is not null and vector_dims(embedding) <> 1536;

alter table profile_embeddings alter column embedding type vector(1536);
alter table event_context_embeddings alter column embedding type vector(1536);

-- Post-ALTER assertion: fail loudly if any row somehow kept wrong dims.
do $$
begin
  if exists (select 1 from profile_embeddings where embedding is not null and vector_dims(embedding) <> 1536) then
    raise exception 'profile_embeddings holds non-1536 vectors after ALTER';
  end if;
  if exists (select 1 from event_context_embeddings where embedding is not null and vector_dims(embedding) <> 1536) then
    raise exception 'event_context_embeddings holds non-1536 vectors after ALTER';
  end if;
end
$$;

drop index if exists profile_embeddings_hnsw;
drop index if exists event_context_embeddings_hnsw;

create index if not exists profile_embeddings_hnsw
  on profile_embeddings using hnsw (embedding vector_cosine_ops);

create index if not exists event_context_embeddings_hnsw
  on event_context_embeddings using hnsw (embedding vector_cosine_ops);

-- Top-N global-vector neighbours restricted to joined members of the
-- given events. The write path (embedding worker / inline API path) calls
-- this instead of loading every vector; the read path never calls it.
create or replace function match_candidates_by_embedding(
  viewer_embedding vector(1536),
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
    and pe.model_id = 'text-embedding-3-small'
    and pe.model_revision = 'azure-te3small-1536-v1'
    and ep.event_id = any(event_ids)
    and ep.status = 'joined'
  order by pe.embedding <=> viewer_embedding
  limit greatest(limit_n, 1)
$$;
