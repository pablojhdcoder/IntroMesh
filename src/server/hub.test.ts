import { describe, expect, it } from "vitest";
import { sha256 } from "@/domain/identity/canonical";
import type { StructuredIdentity } from "@/domain/identity/schema";
import { hydrateDatabase, type Database, type Store } from "@/lib/store/types";
import { hubActions } from "@/server/hub";
import { onboardingActions } from "@/server/onboarding";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");

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
  });
}

describe("hubActions.listMyEvents", () => {
  it("returns joined memberships with event and joined memberCount, no presence", async () => {
    const database = baseDatabase();
    expect(database).not.toHaveProperty("presence");
    const store = fakeStore(database);
    const mine = await hubActions(store).listMyEvents("u1");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ eventId: "e1", status: "joined", memberCount: 1 });
    expect(mine[0]).not.toHaveProperty("presence");
    expect(mine[0]?.event).toMatchObject({ id: "e1", name: "Hackathon", code: "E1" });
    expect(mine[0]?.joinedAt).toBe(new Date(NOW).toISOString());
  });

  it("counts joined members only: 3 joined + 1 left = 3", async () => {
    const database = baseDatabase();
    for (const userId of ["u2", "u3"]) {
      database.profiles.push(profile(userId, `${userId}-slug`, userId));
      database.participations.push({
        userId,
        eventId: "e1",
        intentText: "",
        lookingFor: [],
        collaborationInterests: [],
        revision: 1,
        inputHash: `hash-${userId}`,
        consent: true,
        visibility: "discoverable",
        status: "joined",
        updatedAt: new Date(NOW).toISOString(),
      });
    }
    database.profiles.push(profile("u5", "u5-slug", "u5"));
    database.participations.push({
      userId: "u5",
      eventId: "e1",
      intentText: "",
      lookingFor: [],
      collaborationInterests: [],
      revision: 1,
      inputHash: "hash-u5",
      consent: false,
      visibility: "hidden",
      status: "left",
      updatedAt: new Date(NOW).toISOString(),
    });
    const store = fakeStore(database);
    const mine = await hubActions(store).listMyEvents("u1");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.memberCount).toBe(3);
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
    expect(mine.find((item) => item.eventId === "e1")?.memberCount).toBe(1);
    expect(mine.find((item) => item.eventId === "e2")?.memberCount).toBe(1);
    expect(database.participations.filter((item) => item.userId === "u1" && item.status === "joined")).toHaveLength(2);
  });
});

describe("hubActions.discoverEvents", () => {
  it("excludes ended events, flags joined, and counts joined attendees", async () => {
    const database = baseDatabase();
    database.participations.push({
      userId: "u2",
      eventId: "e1",
      intentText: "",
      lookingFor: [],
      collaborationInterests: [],
      revision: 1,
      inputHash: "hash-u2-e1",
      consent: true,
      visibility: "discoverable",
      status: "joined",
      updatedAt: new Date(NOW).toISOString(),
    });
    const store = fakeStore(database);
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
