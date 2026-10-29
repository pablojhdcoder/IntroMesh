-- IntroMesh. Aplicar en el SQL editor de Supabase cuando haya proyecto.
-- El servidor usa la service role. El cliente no debe recibirla.
-- La presencia digital de una sesión no es proximidad física.

create table if not exists profiles (
  id text primary key,
  slug text not null unique,
  display_name text not null,
  role text not null,
  bio text not null default '',
  interests text[] not null default '{}',
  skills text[] not null default '{}',
  projects text[] not null default '{}',
  offers text not null default '',
  seeking text not null default '',
  goal text not null,
  demo boolean not null default false,
  presentation jsonb,
  created_at timestamptz not null default now()
);

create table if not exists profile_links (
  id bigint generated always as identity primary key,
  profile_id text not null references profiles (id) on delete cascade,
  label text not null,
  url text not null
);

create table if not exists events (
  id text primary key,
  name text not null,
  demo boolean not null default false
);

create table if not exists presence (
  profile_id text not null references profiles (id) on delete cascade,
  event_id text not null references events (id) on delete cascade,
  status text not null check (status in ('active', 'seeking')),
  source text not null check (source in ('session', 'demo')),
  updated_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (profile_id, event_id)
);

create index if not exists presence_event_expires_idx on presence (event_id, expires_at);
create index if not exists profiles_interests_idx on profiles using gin (interests);
create index if not exists profiles_goal_idx on profiles (goal);

create table if not exists connections (
  id text primary key,
  event_id text not null references events (id) on delete cascade,
  from_id text not null references profiles (id) on delete cascade,
  to_id text not null references profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  intro text,
  intro_source text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists connections_event_idx on connections (event_id, status);

create table if not exists analytics_events (
  id text primary key,
  event_id text not null references events (id) on delete cascade,
  type text not null,
  topic text,
  at timestamptz not null
);

create index if not exists analytics_event_type_idx on analytics_events (event_id, type, at);

alter table profiles enable row level security;
alter table profile_links enable row level security;
alter table events enable row level security;
alter table presence enable row level security;
alter table connections enable row level security;
alter table analytics_events enable row level security;

-- Sin Auth de Supabase todavía no hay políticas para el rol anon.
-- Las lecturas de organizador son agregados calculados en el servidor.
