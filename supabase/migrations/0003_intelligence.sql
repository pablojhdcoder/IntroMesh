-- Inteligencia de perfil. Aplicar en el SQL editor cuando exista el proyecto.
-- El servidor usa la service role. El anon no tiene políticas: RLS niega el acceso.

create extension if not exists vector;

alter table events add column if not exists description text not null default '';
alter table events add column if not exists category text not null default '';
alter table events add column if not exists starts_at timestamptz;
alter table events add column if not exists code text;
alter table events add column if not exists status text not null default 'live';
alter table events add column if not exists created_by text;

create unique index if not exists events_code_idx on events (code);

create table if not exists global_identities (
  user_id text primary key references profiles (id) on delete cascade,
  display_name text not null,
  original_description text not null,
  input_hash text not null,
  generated jsonb,
  confirmed jsonb,
  revision integer not null default 0,
  status text not null check (status in ('draft', 'generated', 'confirmed')),
  source text,
  updated_at timestamptz not null default now()
);

create table if not exists event_participations (
  user_id text not null references profiles (id) on delete cascade,
  event_id text not null references events (id) on delete cascade,
  intent_text text not null default '',
  revision integer not null default 0,
  input_hash text not null,
  consent boolean not null default false,
  visibility text not null check (visibility in ('discoverable', 'hidden')),
  status text not null check (status in ('joined', 'left')),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table if not exists profile_embeddings (
  user_id text primary key references profiles (id) on delete cascade,
  embedding vector(384),
  model_id text not null,
  model_revision text not null,
  input_hash text not null,
  profile_revision integer not null,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_context_embeddings (
  user_id text not null references profiles (id) on delete cascade,
  event_id text not null references events (id) on delete cascade,
  embedding vector(384),
  model_id text not null,
  model_revision text not null,
  input_hash text not null,
  profile_revision integer not null,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists profile_embeddings_hnsw
  on profile_embeddings using hnsw (embedding vector_cosine_ops);

create index if not exists event_context_embeddings_hnsw
  on event_context_embeddings using hnsw (embedding vector_cosine_ops);

create table if not exists event_match_recommendations (
  event_id text not null references events (id) on delete cascade,
  viewer_id text not null references profiles (id) on delete cascade,
  candidate_id text not null references profiles (id) on delete cascade,
  identity_similarity double precision,
  context_similarity double precision,
  cosine_distance double precision,
  goal_compatibility double precision,
  skill_complementarity double precision,
  shared_interests double precision,
  final_score double precision not null,
  ranking_version text not null,
  viewer_hash text not null,
  candidate_hash text not null,
  viewer_context_hash text not null,
  candidate_context_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, viewer_id, candidate_id)
);

create table if not exists match_explanations (
  id text primary key,
  cache_key text not null unique,
  event_id text not null references events (id) on delete cascade,
  viewer_id text not null references profiles (id) on delete cascade,
  candidate_id text not null references profiles (id) on delete cascade,
  model_id text not null,
  prompt_version text not null,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  match_reason text,
  shared_signals jsonb,
  complementary_signals jsonb,
  conversation_starter text,
  confidence_notes text,
  structured jsonb,
  input_fingerprint text not null,
  input_tokens integer,
  output_tokens integer,
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table global_identities enable row level security;
alter table event_participations enable row level security;
alter table profile_embeddings enable row level security;
alter table event_context_embeddings enable row level security;
alter table event_match_recommendations enable row level security;
alter table match_explanations enable row level security;

-- Distancia de coseno de un visor contra candidatos del mismo evento:
-- select user_id, embedding <=> $viewer as distance
-- from profile_embeddings
-- where status = 'completed' and user_id = any($ids)
-- order by embedding <=> $viewer
-- limit 24;
