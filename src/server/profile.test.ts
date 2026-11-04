import { describe, expect, it } from "vitest";
import { hydrateDatabase, type Database, type Store } from "@/lib/store/types";
import { profileActions } from "@/server/profile";

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

function profile(id: string, slug: string, displayName: string, extra: Record<string, unknown> = {}) {
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
    ...extra,
  };
}

function baseDatabase(): Database {
  return hydrateDatabase({
    events: [
      { id: "e1", name: "Hackathon", demo: false, description: "Builders", category: "ai", startsAt: null, code: "E1", status: "live", createdBy: null },
    ],
    profiles: [
      profile("u1", "ada-u1", "Ada", { avatarUrl: "https://example.com/ada.png" }),
      profile("u2", "bob-u2", "Bob", { profileVisibility: "private" }),
      profile("u3", "cy-u3", "Cy"),
    ],
    identities: [
      {
        userId: "u1",
        displayName: "Ada",
        originalDescription: "secret original",
        inputHash: "h",
        generated: null,
        confirmed: null,
        revision: 1,
        status: "confirmed",
        source: "user",
        updatedAt: AT,
      },
    ],
    connections: [
      { id: "c1", eventId: "e1", fromId: "u1", toId: "u2", status: "accepted", intro: null, introSource: null, createdAt: AT, acceptedAt: AT },
      { id: "c2", eventId: "e1", fromId: "u3", toId: "u1", status: "accepted", intro: null, introSource: null, createdAt: AT, acceptedAt: AT },
      { id: "c3", eventId: "e1", fromId: "u1", toId: "u3", status: "pending", intro: null, introSource: null, createdAt: AT, acceptedAt: null },
    ],
  });
}

describe("profileActions.publicProfile", () => {
  it("exposes only safe fields with username, avatar, and accepted count", async () => {
    const store = fakeStore(baseDatabase());
    const result = await profileActions(store).publicProfile("ada-u1", "u2");
    expect(result).toMatchObject({
      id: "u1",
      slug: "ada-u1",
      username: "ada-u1",
      displayName: "Ada",
      avatarUrl: "https://example.com/ada.png",
      isOwner: false,
      connectionCount: 2,
      profileVisibility: "public",
    });
    expect(result).not.toHaveProperty("originalDescription");
    expect(result).not.toHaveProperty("intents");
    expect(result).not.toHaveProperty("memberships");
    expect(result).not.toHaveProperty("bio");
  });

  it("returns null for unknown usernames", async () => {
    const store = fakeStore(baseDatabase());
    expect(await profileActions(store).publicProfile("nobody", "u1")).toBeNull();
  });

  it("hides private profiles from others but shows them to the owner", async () => {
    const store = fakeStore(baseDatabase());
    expect(await profileActions(store).publicProfile("bob-u2", "u1")).toBeNull();
    expect(await profileActions(store).publicProfile("bob-u2", null)).toBeNull();
    const own = await profileActions(store).publicProfile("bob-u2", "u2");
    expect(own).toMatchObject({ id: "u2", isOwner: true, profileVisibility: "private" });
  });
});

describe("profileActions.updateProfileSettings", () => {
  it("updates avatar and visibility and returns the public profile", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const result = await profileActions(store).updateProfileSettings("u1", {
      avatarUrl: null,
      profileVisibility: "private",
    });
    expect(result).toMatchObject({ id: "u1", avatarUrl: null, profileVisibility: "private" });
    expect(database.profiles.find((item) => item.id === "u1")?.profileVisibility).toBe("private");
    // Now hidden from others.
    expect(await profileActions(store).publicProfile("ada-u1", "u2")).toBeNull();
  });

  it("returns an error for a missing profile", async () => {
    const store = fakeStore(baseDatabase());
    expect(await profileActions(store).updateProfileSettings("nope", { profileVisibility: "private" })).toEqual({
      error: "profile",
    });
  });
});
