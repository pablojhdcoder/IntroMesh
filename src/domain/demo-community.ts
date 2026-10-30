import { DEMO_EVENT_ID, GOALS, INTERESTS, PROJECTS, SKILLS, type GoalId } from "./catalog";
import type { Presentation, StoredProfile } from "./profile";
import { nextExpiry, type PresenceRecord } from "./presence";
import type { AnalyticsRecord } from "./analytics";

const NAMES = [
  "Ada Vega",
  "Bruno Costa",
  "Nia Okonkwo",
  "Leo Martín",
  "Sara Iqbal",
  "Mateo Ruiz",
  "Inés Palau",
  "Omar Haddad",
  "Lara Kim",
  "Hugo Serra",
  "Noa Benítez",
  "Elías Navarro",
  "Marta Chen",
  "Pol Andrade",
  "Amina Diallo",
  "Teo Ferrer",
  "Julia Sato",
  "Rafa Molina",
  "Claudia Ortiz",
  "Iker Soler",
];

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickMany<T>(rand: () => number, source: readonly T[], count: number): T[] {
  const copy = [...source];
  const chosen: T[] = [];
  while (chosen.length < count && copy.length > 0) {
    const index = Math.floor(rand() * copy.length);
    const [item] = copy.splice(index, 1);
    if (item !== undefined) chosen.push(item);
  }
  return chosen;
}

export function buildDemoCommunity(count = 180, now = Date.now()) {
  const rand = mulberry32(20261104);
  const profiles: StoredProfile[] = [];
  for (let index = 0; index < count; index += 1) {
    const name = NAMES[index % NAMES.length] ?? "Guest";
    const displayName = index < NAMES.length ? name : `${name} ${index + 1}`;
    const goal = GOALS[index % GOALS.length]?.id ?? "hackathon";
    const interests = pickMany(rand, INTERESTS, 2 + (index % 3));
    const skills = pickMany(rand, SKILLS, 2);
    const projects = pickMany(rand, PROJECTS, 1);
    const id = `demo-${String(index + 1).padStart(3, "0")}`;
    const presentation: Presentation = {
      source: "demo",
      headline: `${displayName.split(" ")[0]} · ${goalLabelSafe(goal)}`,
      summary: `Works on ${projects[0]} and lists ${interests.slice(0, 2).join(" and ")}.`,
      opener: `Which part of ${projects[0]} are you showing here?`,
    };
    profiles.push({
      id,
      slug: `${slugify(displayName)}-${id}`,
      displayName,
      role: index % 2 === 0 ? "Researches product" : "Builds prototypes",
      bio: "",
      interests,
      skills,
      projects,
      links: [],
      offers: skills[0] ? `Can help with ${skills[0]}.` : "",
      seeking: interests[0] ? `Looking for conversations about ${interests[0]}.` : "Looking for a concrete conversation.",
      goal,
      demo: true,
      presentation,
      createdAt: new Date(now - index * 60_000).toISOString(),
    });
  }

  const visible = profiles.slice(0, 28);
  const presence: PresenceRecord[] = visible.map((profile, index) => ({
    profileId: profile.id,
    eventId: DEMO_EVENT_ID,
    status: index % 3 === 0 ? "seeking" : "active",
    source: "demo",
    updatedAt: new Date(now).toISOString(),
    expiresAt: nextExpiry(now, 1000 * 60 * 60 * 6),
  }));

  const analytics: AnalyticsRecord[] = [];
  const base = Date.parse("2026-11-04T09:00:00.000Z");
  visible.forEach((profile, index) => {
    const topic = profile.interests[0] ?? null;
    analytics.push({
      id: `seed-rec-${profile.id}`,
      eventId: DEMO_EVENT_ID,
      type: "recommendation_shown",
      at: new Date(base + index * 60_000).toISOString(),
      topic,
    });
    if (index % 2 === 0) {
      analytics.push({
        id: `seed-view-${profile.id}`,
        eventId: DEMO_EVENT_ID,
        type: "profile_viewed",
        at: new Date(base + index * 90_000).toISOString(),
        topic,
      });
    }
    if (index % 4 === 0) {
      analytics.push({
        id: `seed-req-${profile.id}`,
        eventId: DEMO_EVENT_ID,
        type: "intro_requested",
        at: new Date(base + index * 120_000).toISOString(),
        topic,
      });
    }
    if (index % 8 === 0) {
      analytics.push({
        id: `seed-ok-${profile.id}`,
        eventId: DEMO_EVENT_ID,
        type: "connection_accepted",
        at: new Date(base + index * 150_000).toISOString(),
        topic,
      });
      analytics.push({
        id: `seed-qr-${profile.id}`,
        eventId: DEMO_EVENT_ID,
        type: "share_qr",
        at: new Date(base + index * 160_000).toISOString(),
        topic: null,
      });
    }
  });

  return { profiles, presence, analytics };
}

function goalLabelSafe(id: GoalId): string {
  return GOALS.find((goal) => goal.id === id)?.label ?? id;
}
