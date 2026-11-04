import { DEMO_EVENT_ID } from "@/domain/catalog";
import { buildDemoCommunity } from "@/domain/demo-community";
import { getStore } from "@/lib/store";
import { EXTRA_EVENTS } from "@/lib/store/types";

/**
 * Seeds Supabase with the demo community: the Meta Hackathon event plus the
 * 40 visible demo profiles (28 field + 12 founders) with joined participations.
 *
 * Writes through the app's own Supabase store — .data/store.json is not used
 * anywhere. Idempotent: existing ids are skipped, so re-running is safe.
 *
 * Run: npm run seed:supabase (needs NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in .env).
 */
async function main(): Promise<void> {
  const store = getStore();
  const { profiles, participations } = buildDemoCommunity(
    180,
    Date.parse("2026-11-04T09:00:00.000Z"),
  );
  const visibleIds = new Set(participations.map((record) => record.userId));
  const visible = profiles.filter((profile) => visibleIds.has(profile.id));

  const seeded = await store.update((database) => {
    const counts = { events: 0, profiles: 0, participations: 0 };

    const meta = database.events.find((event) => event.id === DEMO_EVENT_ID);
    if (!meta) {
      database.events.push({
        id: DEMO_EVENT_ID,
        name: "Meta Hackathon",
        demo: true,
        description: "Meta Global AI Developer Hackathon — build with Muse Spark, Muse Image and SAM 3.1.",
        category: "hackathon",
        startsAt: "2026-10-26T13:00:00.000Z",
        code: "META-HACK",
        status: "live",
        createdBy: null,
        coverUrl: "/events/meta-hackathon-2026.svg",
      });
      counts.events = 1;
    } else {
      meta.name = "Meta Hackathon";
      meta.description =
        "Meta Global AI Developer Hackathon — build with Muse Spark, Muse Image and SAM 3.1.";
      meta.category = "hackathon";
      meta.startsAt = "2026-10-26T13:00:00.000Z";
      meta.code = "META-HACK";
      meta.status = "live";
      meta.coverUrl = "/events/meta-hackathon-2026.svg";
      counts.events = 1;
    }
    for (const extra of EXTRA_EVENTS) {
      const existing = database.events.find((event) => event.id === extra.id);
      if (!existing) {
        database.events.push({ ...extra });
        counts.events += 1;
        continue;
      }
      existing.name = extra.name;
      existing.demo = false;
      existing.description = extra.description;
      existing.category = extra.category;
      existing.startsAt = extra.startsAt;
      existing.code = extra.code;
      existing.status = extra.status;
      existing.coverUrl = extra.coverUrl;
      counts.events += 1;
    }

    const byId = new Map(database.profiles.map((profile) => [profile.id, profile]));
    for (const profile of visible) {
      const existing = byId.get(profile.id);
      if (!existing) {
        database.profiles.push(profile);
        byId.set(profile.id, profile);
        counts.profiles += 1;
        continue;
      }
      // Upsert fixture fields; keep avatar and visibility if someone set them.
      existing.slug = profile.slug;
      existing.username = profile.username ?? null;
      existing.displayName = profile.displayName;
      existing.role = profile.role;
      existing.bio = profile.bio;
      existing.interests = profile.interests;
      existing.skills = profile.skills;
      existing.projects = profile.projects;
      existing.links = profile.links;
      existing.offers = profile.offers;
      existing.seeking = profile.seeking;
      existing.goal = profile.goal;
      existing.demo = true;
      existing.presentation = profile.presentation;
      counts.profiles += 1;
    }

    const participationKeys = new Set(
      database.participations.map((record) => `${record.userId}::${record.eventId}`),
    );
    for (const record of participations) {
      const key = `${record.userId}::${record.eventId}`;
      if (participationKeys.has(key)) continue;
      database.participations.push(record);
      participationKeys.add(key);
      counts.participations += 1;
    }

    return counts;
  });

  process.stdout.write(`seed-supabase ${JSON.stringify(seeded)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`seed-supabase failed: ${(error as Error).message}\n`);
  process.exit(1);
});
