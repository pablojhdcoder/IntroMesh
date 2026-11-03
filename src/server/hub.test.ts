import { describe, expect, it } from "vitest";
import { sha256 } from "@/domain/identity/canonical";
import type { StructuredIdentity } from "@/domain/identity/schema";
import { hydrateDatabase, type Database, type Store } from "@/lib/store/types";
import { hubActions } from "@/server/hub";
import { onboardingActions } from "@/server/onboarding";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");
const LIVE = new Date(Date.now() + 3_600_000).toISOString();
const EXPIRED = new Date(Date.now() - 3_600_000).toISOString();

const identity: StructuredIdentity = {
  display_name: "Ada",
  professional_role: "Software developer",
  short_bio: "Builds AI products.",
  interests: ["AI"],
  skills: ["Prototyping"],
  projects: [],
  can_offer: ["Technical development"],
  looking_for: ["Founders"],
  professional_focus: ["AI products"],
  conversation_topics: ["AI product development"],
  languages: [],
  profile_summary: "Developer building AI products.",
};

function fakeStore(database: Database): Store {
  return {
    file: "test",
    read: () => Promise.resolve(database),
    update: <T>(mutator: (database: Database) => T | Promise<T>): Promise<T> =>
      Promise.resolve().then(() => mutator(database)),
  };
}

function profile(id: string, slug: string, displayName: string) {
  return {
    id,
    slug,
    displayName,
    role: "Software developer",
    bio: "",
    interests: ["AI"],
    skills: ["Prototyping"],
    projects: [],
    links: [],
    offers: "",
    seeking: "",
    goal: "cofounder" as const,
    demo: false,
    presentation: null,
    createdAt: new Date(NOW).toISOString(),
  };
}

function baseDatabase(): Database {
  return hydrateDatabase({
    events: [
      { id: "e1", name: "Hackathon", demo: false, description: "Builders", category: "ai", startsAt: null, code: "E1", status: "live", createdBy: null },
      { id: "e2", name: "Design night", demo: false, description: "Designers", category: "design", startsAt: null, code: "E2", status: "live", createdBy: null },
      { id: "e3", name: "Old meetup", demo: false, description: "Past", category: "ai", startsAt: null, code: "E3", status: "ended", createdBy: null },
    ],
    profiles: [profile("u1", "ada-u1", "Ada"), profile("u2", "bob-u2", "Bob")],
    identities: [
      {
        userId: "u1",
        displayName: "Ada",
        originalDescription: "I build AI products.",
        inputHash: sha256("I build AI products."),
        generated: identity,
        confirmed: identity,
        revision: 1,
        status: "confirmed",
        source: "model",
        updatedAt: new Date(NOW).toISOString(),
      },
    ],
    participations: [
      {
        userId: "u1",
        eventId: "e1",
        intentText: "Meet builders",
        lookingFor: ["Founders"],
        collaborationInterests: [],
        revision: 1,
        inputHash: "hash-e1",
        consent: true,
        visibility: "discoverable",
        status: "joined",
        updatedAt: new Date(NOW).toISOString(),
      },
    ],
    presence: [
      { profileId: "u1", eventId: "e1", status: "active", source: "session", updatedAt: new Date(NOW).toISOString(), expiresAt: LIVE },
      { profileId: "u2", eventId: "e1", status: "active", source: "session", updatedAt: new Date(NOW).toISOString(), expiresAt: LIVE },
      { profileId: "u2", eventId: "e2", status: "active", source: "session", updatedAt: new Date(NOW).toISOString(), expiresAt: EXPIRED },
    ],
  });
}

describe("hubActions.listMyEvents", () => {
  it("returns joined memberships with event and live presence", async () => {
    const store = fakeStore(baseDatabase());
    const mine = await hubActions(store).listMyEvents("u1");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ eventId: "e1", status: "joined", presence: "active" });
    expect(mine[0].event).toMatchObject({ id: "e1", name: "Hackathon", code: "E1" });
    expect(mine[0].joinedAt).toBe(new Date(NOW).toISOString());
  });

  it("keeps contexts independent after joining a second event", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    await onboardingActions(store).joinEvent("u1", "e2", "Meet designers");
    const mine = await hubActions(store).listMyEvents("u1");
    expect(mine.map((item) => item.eventId).sort()).toEqual(["e1", "e2"]);
    const intents = database.participations
      .filter((item) => item.userId === "u1")
      .map((item) => [item.eventId, item.intentText]);
    expect(intents).toContainEqual(["e1", "Meet builders"]);
    expect(intents).toContainEqual(["e2", "Meet designers"]);
    // Joining e2 creates live presence there; e1's stays live too (single
    // "active" status, scoped per event).
    expect(mine.find((item) => item.eventId === "e1")?.presence).toBe("active");
    expect(mine.find((item) => item.eventId === "e2")?.presence).toBe("active");
    expect(database.participations.filter((item) => item.userId === "u1" && item.status === "joined")).toHaveLength(2);
  });
});

describe("hubActions.discoverEvents", () => {
  it("excludes ended events, flags joined, and counts live attendees", async () => {
    const store = fakeStore(baseDatabase());
    const events = await hubActions(store).discoverEvents("u1");
    expect(events.map((item) => item.id).sort()).toEqual(["e1", "e2"]);
    expect(events.find((item) => item.id === "e1")).toMatchObject({ joined: true, attendees: 2 });
    expect(events.find((item) => item.id === "e2")).toMatchObject({ joined: false, attendees: 0 });
  });

  it("filters by query like listEvents", async () => {
    const store = fakeStore(baseDatabase());
    const events = await hubActions(store).discoverEvents("u1", "design");
    expect(events.map((item) => item.id)).toEqual(["e2"]);
  });
});
