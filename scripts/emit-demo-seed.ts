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
  const { profiles, participations, analytics } = buildDemoCommunity(180, Date.parse("2026-11-04T09:00:00.000Z"));
  const visibleIds = new Set(participations.map((record) => record.userId));
  const visible = profiles.filter((profile) => visibleIds.has(profile.id));

  const profileRows = visible
    .map(
      (profile) =>
        `  (${sqlString(profile.id)}, ${sqlString(profile.slug)}, ${sqlString(profile.username ?? profile.slug)}, ${sqlString(profile.displayName)}, ${sqlString(profile.role)}, ${sqlString(profile.bio)}, ${sqlArray(profile.interests)}, ${sqlArray(profile.skills)}, ${sqlArray(profile.projects)}, ${sqlString(profile.offers)}, ${sqlString(profile.seeking)}, ${sqlString(profile.goal)}, true, ${profile.presentation ? sqlJson(profile.presentation) : "null"}, ${sqlString(profile.createdAt)})`,
    )
    .join(",\n");

  const linkRows = visible
    .flatMap((profile) =>
      profile.links.map((link) => `  (${sqlString(profile.id)}, ${sqlString(link.label)}, ${sqlString(link.url)})`),
    )
    .join(",\n");

  const participationRows = participations
    .map(
      (record) =>
        `  (${sqlString(record.userId)}, ${sqlString(record.eventId)}, '', '{}'::text[], '{}'::text[], 0, ${sqlString(record.inputHash)}, true, 'discoverable', 'joined', now(), now(), 'attendee', null)`,
    )
    .join(",\n");

  const analyticsRows = analytics
    .map(
      (record) =>
        `  (${sqlString(record.id)}, ${sqlString(record.eventId)}, ${sqlString(record.type)}, ${record.topic ? sqlString(record.topic) : "null"}, ${sqlString(record.at)})`,
    )
    .join(",\n");

  const sql = `-- Semilla demo de IntroMesh. Idempotente.
-- Los 28 perfiles con participación joined son los del campo. demo = true: no disparan Meta Model API.
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
  id, slug, username, display_name, role, bio, interests, skills, projects, offers, seeking, goal, demo, presentation, created_at
) values
${profileRows}
on conflict (id) do update set
  slug = excluded.slug,
  username = excluded.username,
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

delete from profile_links where profile_id in (select id from profiles where demo = true);

insert into profile_links (profile_id, label, url)
values
${linkRows};

insert into event_participations (user_id, event_id, intent_text, looking_for, collaboration_interests, revision, input_hash, consent, visibility, status, updated_at, joined_at, role, last_active_at)
values
${participationRows}
on conflict (user_id, event_id) do update set
  status = 'joined',
  consent = true,
  visibility = 'discoverable',
  updated_at = excluded.updated_at,
  joined_at = excluded.joined_at;

insert into analytics_events (id, event_id, type, topic, at)
values
${analyticsRows}
on conflict (id) do nothing;
`;

  const target = path.join(process.cwd(), "supabase", "migrations", "0002_demo_seed.sql");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, sql, "utf8");
  process.stdout.write(`${target}\n${visible.length} perfiles, ${participations.length} participaciones, ${analytics.length} analíticas\n`);
}

void main();
