import { describe, expect, it } from "vitest";
import { hydrateDatabase, type Database, type Store } from "@/lib/store/types";
import { connectActions } from "@/server/connect";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");
const AT = new Date(NOW).toISOString();

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
    createdAt: AT,
  };
}

function participation(userId: string, eventId: string) {
  return {
    userId,
    eventId,
    intentText: "Meet people",
    lookingFor: ["Founders"],
    collaborationInterests: [],
    revision: 1,
    inputHash: `hash-${eventId}`,
    consent: true,
    visibility: "discoverable" as const,
    status: "joined" as const,
    updatedAt: AT,
  };
}

function baseDatabase(): Database {
  return hydrateDatabase({
    events: [
      { id: "e1", name: "Hackathon", demo: false, description: "Builders", category: "ai", startsAt: null, code: "E1", status: "live", createdBy: null },
      { id: "e2", name: "Design night", demo: false, description: "Designers", category: "design", startsAt: null, code: "E2", status: "live", createdBy: null },
    ],
    profiles: [profile("u1", "ada-u1", "Ada"), profile("u2", "bob-u2", "Bob"), profile("u3", "cy-u3", "Cy"), profile("u4", "dee-u4", "Dee")],
    participations: [
      participation("u1", "e1"),
      participation("u1", "e2"),
      participation("u2", "e1"),
      participation("u4", "e1"),
      participation("u4", "e2"),
    ],
    connections: [
      { id: "c1", eventId: "e1", fromId: "u1", toId: "u2", status: "accepted", intro: null, introSource: null, createdAt: AT, acceptedAt: AT },
      { id: "c2", eventId: "e2", fromId: "u3", toId: "u1", status: "pending", intro: "hi", introSource: "user", createdAt: AT, acceptedAt: null },
    ],
  });
}

describe("connectActions.connections", () => {
  it("returns connections across all events with eventName when no eventId", async () => {
    const store = fakeStore(baseDatabase());
    const all = await connectActions(store).connections("u1");
    expect(all.map((item) => item.id).sort()).toEqual(["c1", "c2"]);
    expect(all.find((item) => item.id === "c1")).toMatchObject({ eventName: "Hackathon" });
    expect(all.find((item) => item.id === "c2")).toMatchObject({ eventName: "Design night" });
  });

  it("scopes to one event when eventId is given", async () => {
    const store = fakeStore(baseDatabase());
    const scoped = await connectActions(store).connections("u1", "e1");
    expect(scoped.map((item) => item.id)).toEqual(["c1"]);
  });

  it("marks direction and who can resolve", async () => {
    const store = fakeStore(baseDatabase());
    const mine = await connectActions(store).connections("u1");
    expect(mine.find((item) => item.id === "c1")).toMatchObject({ direction: "outgoing", canResolve: false });
    expect(mine.find((item) => item.id === "c2")).toMatchObject({ direction: "incoming", canResolve: true });
    const theirs = await connectActions(store).connections("u2");
    expect(theirs.find((item) => item.id === "c1")).toMatchObject({ direction: "incoming", canResolve: false });
  });
});

describe("connectActions.requestConnection", () => {
  it("dedupes the reverse direction for pending or accepted pairs", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await connectActions(store).requestConnection("u2", "u1", "hello", "user", "e1");
    expect(result).toMatchObject({ id: "c1" });
    expect(database.connections).toHaveLength(2);
  });

  it("requires a joined participation when eventId is provided", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await connectActions(store).requestConnection("u1", "u4", "hello", "user", "e-missing");
    expect(result).toEqual({ error: "event" });
    expect(database.connections).toHaveLength(2);
  });

  it("rejects when the other person is not joined in the explicit event", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await connectActions(store).requestConnection("u1", "u3", "hello", "user", "e2");
    expect(result).toEqual({ error: "event" });
    expect(database.connections).toHaveLength(2);
  });

  it("creates a connection in the explicit event when joined", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await connectActions(store).requestConnection("u1", "u4", "hello", "user", "e2");
    expect(result).toMatchObject({ eventId: "e2", fromId: "u1", toId: "u4", status: "pending" });
    expect(database.connections).toHaveLength(3);
  });

  it("rejects a request to yourself", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await connectActions(store).requestConnection("u1", "u1", "hello", "user", "e1");
    expect(result).toEqual({ error: "forbidden" });
    expect(database.connections).toHaveLength(2);
  });

  it("allows re-requesting a declined pair", async () => {
    const database = baseDatabase();
    database.connections.push({
      id: "c9", eventId: "e1", fromId: "u4", toId: "u1", status: "declined", intro: null, introSource: null, createdAt: AT, acceptedAt: null,
    });
    const store = fakeStore(database);
    const result = await connectActions(store).requestConnection("u1", "u4", "again", "user", "e1");
    expect(result).toMatchObject({ status: "pending", fromId: "u1", toId: "u4" });
    expect(database.connections.filter((item) => item.status === "pending" && item.toId === "u4")).toHaveLength(1);
  });
});

describe("connectActions.resolveConnection", () => {
  it("lets the recipient accept a pending request", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await connectActions(store).resolveConnection("u1", "c2", "accept");
    expect(result).toMatchObject({ connection: { id: "c2", status: "accepted" } });
    expect(database.connections.find((item) => item.id === "c2")?.acceptedAt).not.toBeNull();
  });

  it("refuses to resolve for the sender", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await connectActions(store).resolveConnection("u3", "c2", "accept");
    expect(result).toEqual({ error: "forbidden" });
    expect(database.connections.find((item) => item.id === "c2")?.status).toBe("pending");
  });

  it("refuses to resolve an already-resolved connection twice", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    await connectActions(store).resolveConnection("u1", "c2", "accept");
    const again = await connectActions(store).resolveConnection("u1", "c2", "decline");
    expect(again).toEqual({ error: "state" });
    expect(database.connections.find((item) => item.id === "c2")?.status).toBe("accepted");
  });

  it("returns missing for an unknown connection", async () => {
    const store = fakeStore(baseDatabase());
    const result = await connectActions(store).resolveConnection("u1", "nope", "accept");
    expect(result).toEqual({ error: "missing" });
  });
});
