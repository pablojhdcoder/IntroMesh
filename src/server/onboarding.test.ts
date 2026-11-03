import { describe, expect, it } from "vitest";
import { sha256 } from "@/domain/identity/canonical";
import type { StructuredIdentity } from "@/domain/identity/schema";
import { hydrateDatabase, type Database, type Store } from "@/lib/store/types";
import { onboardingActions } from "@/server/onboarding";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");
const LIVE = new Date(Date.now() + 3_600_000).toISOString();

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

function baseDatabase(): Database {
  return hydrateDatabase({
    events: [
      {
        id: "e1",
        name: "Hackathon",
        demo: false,
        description: "Builders",
        category: "ai",
        startsAt: null,
        code: "E1",
        status: "live",
        createdBy: null,
      },
      {
        id: "e2",
        name: "Design night",
        demo: false,
        description: "Designers",
        category: "design",
        startsAt: null,
        code: "E2",
        status: "live",
        createdBy: null,
      },
    ],
    profiles: [
      {
        id: "u1",
        slug: "ada-u1",
        displayName: "Ada",
        role: "Software developer",
        bio: "",
        interests: ["AI"],
        skills: ["Prototyping"],
        projects: [],
        links: [],
        offers: "",
        seeking: "",
        goal: "cofounder",
        demo: false,
        presentation: null,
        createdAt: new Date(NOW).toISOString(),
      },
    ],
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
      {
        profileId: "u1",
        eventId: "e1",
        status: "active",
        source: "session",
        updatedAt: new Date(NOW).toISOString(),
        expiresAt: LIVE,
      },
    ],
  });
}

describe("leaveEvent", () => {
  it("marks the participation left, hides it, and removes session presence", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await onboardingActions(store).leaveEvent("u1", "e1");
    expect(result).toEqual({ left: true, eventId: "e1" });

    const participation = database.participations.find((item) => item.userId === "u1" && item.eventId === "e1");
    expect(participation?.status).toBe("left");
    expect(participation?.consent).toBe(false);
    expect(participation?.visibility).toBe("hidden");
    expect(database.presence.filter((item) => item.profileId === "u1" && item.eventId === "e1")).toHaveLength(0);

    // Identity and profile survive the leave so rejoin skips them.
    expect(database.identities.find((item) => item.userId === "u1")?.status).toBe("confirmed");
    expect(database.profiles.find((item) => item.id === "u1")).toBeDefined();
  });

  it("is idempotent: leaving twice still succeeds", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    await onboardingActions(store).leaveEvent("u1", "e1");
    const again = await onboardingActions(store).leaveEvent("u1", "e1");
    expect(again).toEqual({ left: true, eventId: "e1" });
    expect(database.participations.find((item) => item.userId === "u1" && item.eventId === "e1")?.status).toBe("left");
  });

  it("succeeds when there is no participation, clearing stray presence", async () => {
    const database = baseDatabase();
    database.participations = [];
    const store = fakeStore(database);
    const result = await onboardingActions(store).leaveEvent("u1", "e1");
    expect(result).toEqual({ left: true, eventId: "e1" });
    expect(database.presence.filter((item) => item.profileId === "u1" && item.eventId === "e1")).toHaveLength(0);
  });

  it("leaves other events untouched", async () => {
    const database = baseDatabase();
    database.participations.push({
      userId: "u1",
      eventId: "e2",
      intentText: "Meet designers",
      lookingFor: ["Founders"],
      collaborationInterests: [],
      revision: 1,
      inputHash: "hash-e2",
      consent: true,
      visibility: "discoverable",
      status: "joined",
      updatedAt: new Date(NOW).toISOString(),
    });
    const store = fakeStore(database);
    await onboardingActions(store).leaveEvent("u1", "e1");
    expect(database.participations.find((item) => item.eventId === "e2")?.status).toBe("joined");
  });

  it("leaves no joined event so the session returns to setup", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    await onboardingActions(store).leaveEvent("u1", "e1");
    const joined = database.participations.filter((item) => item.userId === "u1" && item.status === "joined");
    expect(joined).toHaveLength(0);
    // Identity stays confirmed so rejoin skips straight to the event step.
    expect(database.identities.find((item) => item.userId === "u1")?.status).toBe("confirmed");
  });
});
