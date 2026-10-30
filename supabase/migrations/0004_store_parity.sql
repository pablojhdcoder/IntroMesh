-- Paridad con el store de aplicación. Pegar en el SQL editor después de 0001–0003.
-- Permite borradores de identidad antes del perfil confirmado y cola de embeddings.

alter table global_identities drop constraint if exists global_identities_user_id_fkey;

alter table event_participations
  add column if not exists looking_for text[] not null default '{}',
  add column if not exists collaboration_interests text[] not null default '{}';

alter table profile_embeddings
  add column if not exists attempts integer not null default 0,
  add column if not exists lease_until timestamptz,
  add column if not exists error text;

alter table event_context_embeddings
  add column if not exists attempts integer not null default 0,
  add column if not exists lease_until timestamptz,
  add column if not exists error text;

alter table event_match_recommendations
  add column if not exists event_relevance double precision,
  add column if not exists confidence text not null default 'low',
  add column if not exists shared_goal_labels text[] not null default '{}',
  add column if not exists shared_interest_labels text[] not null default '{}',
  add column if not exists shared_skill_labels text[] not null default '{}',
  add column if not exists complement_labels text[] not null default '{}';

alter table match_explanations
  add column if not exists lease_until timestamptz;

create table if not exists engine_metrics (
  id integer primary key check (id = 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table engine_metrics enable row level security;

insert into engine_metrics (id, payload)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

create or replace function intromesh_advisory_lock()
returns void
language sql
security definer
set search_path = public
as $$
  select pg_advisory_lock(872314);
$$;

create or replace function intromesh_advisory_unlock()
returns void
language sql
security definer
set search_path = public
as $$
  select pg_advisory_unlock(872314);
$$;

update events
set
  description = coalesce(nullif(description, ''), 'In-person networking at the Meta Global AI Developer Hackathon.'),
  category = coalesce(nullif(category, ''), 'hackathon'),
  code = coalesce(nullif(code, ''), 'META-HACK'),
  status = coalesce(nullif(status, ''), 'live')
where id = 'meta-hackathon-2026';
