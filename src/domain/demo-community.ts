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
    // Synthetic fixture copy: never authored by the model, so it must not
    // claim the model source. The demo badge rides on profile.demo.
    const presentation: Presentation = {
      source: "user",
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

  const founders = FOUNDERS.map((entry, index) => founderProfile(entry, index, now));
  const visible = [...profiles.slice(0, 28), ...founders];
  const presence: PresenceRecord[] = visible.map((profile) => ({
    profileId: profile.id,
    eventId: DEMO_EVENT_ID,
    status: "active",
    source: "demo",
    updatedAt: new Date(now).toISOString(),
    expiresAt: nextExpiry(now),
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

  return { profiles: [...profiles, ...founders], presence, analytics };
}

const FOUNDERS: Array<{
  displayName: string;
  role: string;
  goal: GoalId;
  interests: string[];
  skills: string[];
  projects: string[];
  offers: string;
  seeking: string;
}> = [
  {
    displayName: "Nadia Ferrer",
    role: "SaaS founder, seed stage",
    goal: "cofounder",
    interests: ["product", "models", "data"],
    skills: ["prototyping", "frontend"],
    projects: ["signal map"],
    offers: "Can help with prototyping.",
    seeking: "Looking for backend and data to scale the prototype.",
  },
  {
    displayName: "Marco Vidal",
    role: "Fintech founder",
    goal: "collaborate",
    interests: ["product", "data", "privacy"],
    skills: ["backend", "analysis"],
    projects: ["matching table"],
    offers: "Can help with backend.",
    seeking: "Looking for frontend and design for onboarding.",
  },
  {
    displayName: "Elena Sanz",
    role: "Climate founder",
    goal: "cofounder",
    interests: ["climate", "data", "hardware"],
    skills: ["research", "hardware"],
    projects: ["open sensor"],
    offers: "Can help with research.",
    seeking: "Looking for backend and prototyping for sensor data.",
  },
  {
    displayName: "David Okafor",
    role: "AI infra founder",
    goal: "discipline",
    interests: ["models", "data", "product"],
    skills: ["backend", "research"],
    projects: ["matching table"],
    offers: "Can help with research.",
    seeking: "Looking for frontend and facilitation for evals.",
  },
  {
    displayName: "Sofia Marin",
    role: "Health founder",
    goal: "hackathon",
    interests: ["health", "data", "privacy"],
    skills: ["analysis", "writing"],
    projects: ["clinical log"],
    offers: "Can help with analysis.",
    seeking: "Looking for backend and hardware for a pilot.",
  },
  {
    displayName: "Pau Ros",
    role: "Marketplace founder",
    goal: "collaborate",
    interests: ["community", "product", "data"],
    skills: ["frontend", "facilitation"],
    projects: ["craft tutor"],
    offers: "Can help with frontend.",
    seeking: "Looking for backend and analysis for matching.",
  },
  {
    displayName: "Laia Font",
    role: "Edtech founder",
    goal: "cofounder",
    interests: ["education", "models", "community"],
    skills: ["writing", "facilitation"],
    projects: ["craft tutor"],
    offers: "Can help with writing.",
    seeking: "Looking for frontend and prototyping for a pilot.",
  },
  {
    displayName: "Joan Casas",
    role: "Hardware founder",
    goal: "hackathon",
    interests: ["hardware", "climate", "product"],
    skills: ["hardware", "prototyping"],
    projects: ["open sensor"],
    offers: "Can help with hardware.",
    seeking: "Looking for analysis and backend for field data.",
  },
  {
    displayName: "Mireia Sole",
    role: "Data founder",
    goal: "discipline",
    interests: ["data", "privacy", "models"],
    skills: ["analysis", "backend"],
    projects: ["climate archive"],
    offers: "Can help with analysis.",
    seeking: "Looking for writing and frontend for reports.",
  },
  {
    displayName: "Oriol Batlle",
    role: "Devtools founder",
    goal: "collaborate",
    interests: ["product", "models", "community"],
    skills: ["frontend", "backend"],
    projects: ["signal map"],
    offers: "Can help with frontend.",
    seeking: "Looking for research and design for docs.",
  },
  {
    displayName: "Carla Mora",
    role: "Civic tech founder",
    goal: "cofounder",
    interests: ["community", "climate", "education"],
    skills: ["facilitation", "research"],
    projects: ["climate archive"],
    offers: "Can help with facilitation.",
    seeking: "Looking for prototyping and frontend for a pilot.",
  },
  {
    displayName: "Nil Baro",
    role: "Privacy infra founder",
    goal: "discipline",
    interests: ["privacy", "models", "health"],
    skills: ["backend", "writing"],
    projects: ["signal map"],
    offers: "Can help with backend.",
    seeking: "Looking for analysis and research for audits.",
  },
];

function founderProfile(entry: (typeof FOUNDERS)[number], index: number, now: number): StoredProfile {
  const id = `demo-f${String(index + 1).padStart(2, "0")}`;
  // Synthetic fixture copy: never authored by the model, so it must not
  // claim the model source. The demo badge rides on profile.demo.
  const presentation: Presentation = {
    source: "user",
    headline: `${entry.displayName.split(" ")[0]} · ${goalLabelSafe(entry.goal)}`,
    summary: `Founder working on ${entry.projects[0]} focused on ${entry.interests.slice(0, 2).join(" and ")}.`,
    opener: `Which part of ${entry.projects[0]} are you scaling here?`,
  };
  return {
    id,
    slug: `${slugify(entry.displayName)}-${id}`,
    displayName: entry.displayName,
    role: entry.role,
    bio: "",
    interests: [...entry.interests],
    skills: [...entry.skills],
    projects: [...entry.projects],
    links: [],
    offers: entry.offers,
    seeking: entry.seeking,
    goal: entry.goal,
    demo: true,
    presentation,
    createdAt: new Date(now - (180 + index) * 60_000).toISOString(),
  };
}

function goalLabelSafe(id: GoalId): string {
  return GOALS.find((goal) => goal.id === id)?.label ?? id;
}
