import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_EVENT_ID } from "../src/domain/catalog";
import { buildDemoCommunity } from "../src/domain/demo-community";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlArray(values: readonly string[]): string {
  if (values.length === 0) return `'{}'::text[]`;
  return `ARRAY[${values.map(sqlString).join(", ")}]::text[]`;
}

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

async function main() {
  const { profiles, presence, analytics } = buildDemoCommunity(180, Date.parse("2026-11-04T09:00:00.000Z"));
  const visibleIds = new Set(presence.map((record) => record.profileId));
  const visible = profiles.filter((profile) => visibleIds.has(profile.id));

  const profileRows = visible
    .map(
      (profile) =>
        `  (${sqlString(profile.id)}, ${sqlString(profile.slug)}, ${sqlString(profile.displayName)}, ${sqlString(profile.role)}, ${sqlString(profile.bio)}, ${sqlArray(profile.interests)}, ${sqlArray(profile.skills)}, ${sqlArray(profile.projects)}, ${sqlString(profile.offers)}, ${sqlString(profile.seeking)}, ${sqlString(profile.goal)}, true, ${profile.presentation ? sqlJson(profile.presentation) : "null"}, ${sqlString(profile.createdAt)})`,
    )
    .join(",\n");

  const presenceRows = presence
    .map(
      (record) =>
        `  (${sqlString(record.profileId)}, ${sqlString(record.eventId)}, ${sqlString(record.status)}, 'demo', now(), now() + interval '6 hours')`,
    )
    .join(",\n");

  const analyticsRows = analytics
    .map(
      (record) =>
        `  (${sqlString(record.id)}, ${sqlString(record.eventId)}, ${sqlString(record.type)}, ${record.topic ? sqlString(record.topic) : "null"}, ${sqlString(record.at)})`,
    )
    .join(",\n");

  const sql = `-- Semilla demo de IntroMesh. Idempotente.
-- Los 28 perfiles con presencia son los del campo. demo = true: no disparan Meta Model API.
-- Pegar en el SQL editor de Supabase después de 0001_init.sql.

create table if not exists affinity_explanations (
  cache_key text primary key,
  viewer_id text not null references profiles (id) on delete cascade,
  other_id text not null references profiles (id) on delete cascade,
  source text not null check (source in ('model', 'demo')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table affinity_explanations enable row level security;

insert into events (id, name, demo)
values (${sqlString(DEMO_EVENT_ID)}, 'Meta Hackathon', true)
on conflict (id) do update set name = excluded.name, demo = excluded.demo;

insert into profiles (
  id, slug, display_name, role, bio, interests, skills, projects, offers, seeking, goal, demo, presentation, created_at
) values
${profileRows}
on conflict (id) do update set
  slug = excluded.slug,
  display_name = excluded.display_name,
  role = excluded.role,
  bio = excluded.bio,
  interests = excluded.interests,
  skills = excluded.skills,
  projects = excluded.projects,
  offers = excluded.offers,
  seeking = excluded.seeking,
  goal = excluded.goal,
  demo = true,
  presentation = excluded.presentation;

insert into presence (profile_id, event_id, status, source, updated_at, expires_at)
values
${presenceRows}
on conflict (profile_id, event_id) do update set
  status = excluded.status,
  source = 'demo',
  updated_at = excluded.updated_at,
  expires_at = excluded.expires_at;

insert into analytics_events (id, event_id, type, topic, at)
values
${analyticsRows}
on conflict (id) do nothing;
`;

  const target = path.join(process.cwd(), "supabase", "migrations", "0002_demo_seed.sql");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, sql, "utf8");
  process.stdout.write(`${target}\n${visible.length} perfiles, ${presence.length} presencias, ${analytics.length} analíticas\n`);
}

void main();
