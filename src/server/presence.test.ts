import { describe, expect, it } from "vitest";
import { hydrateDatabase, type Database, type Store } from "@/lib/store/types";
import { presenceActions } from "@/server/presence";

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
        description: "",
        category: "ai",
        startsAt: null,
        code: "E1",
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
        interests: [],
        skills: [],
        projects: [],
        links: [],
        offers: "",
        seeking: "",
        goal: "cofounder",
        demo: false,
        presentation: null,
        createdAt: new Date().toISOString(),
      },
    ],
    participations: [
      {
        userId: "u1",
        eventId: "e1",
        intentText: "",
        lookingFor: [],
        collaborationInterests: [],
        revision: 1,
        inputHash: "hash",
        consent: false,
        visibility: "hidden",
        status: "left",
        updatedAt: new Date().toISOString(),
      },
    ],
  });
}

describe("setPresence after leave", () => {
  it("refuses to reactivate a left participation and creates no presence", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await presenceActions(store).setPresence("u1", "e1");
    expect(result).toEqual({ error: "profile" });
    expect(database.presence).toHaveLength(0);
    expect(database.participations.find((item) => item.eventId === "e1")?.status).toBe("left");
  });

  it("still activates a joined participation", async () => {
    const database = baseDatabase();
    const participation = database.participations.find((item) => item.eventId === "e1");
    if (participation) {
      participation.status = "joined";
      participation.consent = true;
      participation.visibility = "discoverable";
    }
    const store = fakeStore(database);
    const result = await presenceActions(store).setPresence("u1", "e1");
    expect(result).toEqual({ status: "active" });
    expect(database.presence.filter((item) => item.profileId === "u1" && item.eventId === "e1")).toHaveLength(1);
  });

  it("refuses heartbeat without a joined participation and creates no presence", async () => {
    const database = baseDatabase();
    database.participations = [];
    const store = fakeStore(database);
    const result = await presenceActions(store).setPresence("u1", "e1");
    expect(result).toEqual({ error: "profile" });
    expect(database.presence).toHaveLength(0);
  });
});
