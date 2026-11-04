import { describe, expect, it } from "vitest";
import { hydrateDatabase, type Database, type Store } from "@/lib/store/types";
import { authActions } from "@/server/auth";
import { hashPassword } from "@/lib/auth/password";

function fakeStore(database: Database): Store {
  return {
    file: "test",
    read: () => Promise.resolve(database),
    update: <T>(mutator: (database: Database) => T | Promise<T>): Promise<T> =>
      Promise.resolve().then(() => mutator(database)),
  };
}

function emptyDb(): Database {
  return hydrateDatabase({ events: [], profiles: [], analytics: [], participations: [] });
}

describe("auth actions", () => {
  it("registers without creating a profile", async () => {
    const db = emptyDb();
    const result = await authActions(fakeStore(db)).register({
      username: "pablo",
      password: "Abcdef1!gh",
    });
    expect(result).toMatchObject({ username: "pablo" });
    expect(db.accounts).toHaveLength(1);
    expect(db.profiles).toHaveLength(0);
  });

  it("rejects duplicates case-insensitively", async () => {
    const db = emptyDb();
    const actions = authActions(fakeStore(db));
    await actions.register({ username: "pablo", password: "Abcdef1!gh" });
    expect(await actions.register({ username: "Pablo", password: "Abcdef1!gh" })).toEqual({
      error: "username_taken",
    });
  });

  it("rejects usernames colliding with profiles", async () => {
    const passwordHash = await hashPassword("Abcdef1!gh");
    const db = hydrateDatabase({
      events: [],
      analytics: [],
      participations: [],
      profiles: [
        {
          id: "user-1",
          slug: "taken-user",
          displayName: "Taken",
          role: "Builder",
          bio: "",
          interests: [],
          skills: [],
          projects: [],
          links: [],
          offers: "",
          seeking: "",
          goal: "hackathon",
          demo: false,
          username: "taken",
          presentation: null,
          createdAt: new Date().toISOString(),
        },
      ],
      accounts: [
        {
          userId: "user-1",
          username: "taken",
          passwordHash,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
      ],
    });
    expect(
      await authActions(fakeStore(db)).register({ username: "TAKEN", password: "Abcdef1!gh" }),
    ).toEqual({ error: "username_taken" });
  });

  it("logs in and hides the failure reason", async () => {
    const db = emptyDb();
    const actions = authActions(fakeStore(db));
    await actions.register({ username: "pablo", password: "Abcdef1!gh" });
    const ok = await actions.login({ username: "PABLO", password: "Abcdef1!gh" });
    expect(ok).toMatchObject({ username: "pablo" });
    expect(await actions.login({ username: "pablo", password: "wrong-wrong-1!A" })).toEqual({
      error: "credentials",
    });
    expect(await actions.login({ username: "ghost", password: "Abcdef1!gh" })).toEqual({
      error: "credentials",
    });
  });

  it("claims a legacy profile without touching the slug", async () => {
    const db = hydrateDatabase({
      events: [],
      analytics: [],
      participations: [],
      profiles: [
        {
          id: "user-legacy",
          slug: "manuel-manuel-abc",
          displayName: "Manuel",
          role: "Builder",
          bio: "",
          interests: [],
          skills: [],
          projects: [],
          links: [],
          offers: "",
          seeking: "",
          goal: "hackathon",
          demo: false,
          presentation: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const result = await authActions(fakeStore(db)).claim("user-legacy", {
      username: "manuel",
      password: "Abcdef1!gh",
    });
    expect(result).toEqual({ userId: "user-legacy", username: "manuel" });
    expect(db.profiles[0]?.username).toBe("manuel");
    expect(db.profiles[0]?.slug).toBe("manuel-manuel-abc");
  });

  it("refuses demo claims", async () => {
    const db = hydrateDatabase({
      events: [],
      analytics: [],
      participations: [],
      profiles: [
        {
          id: "demo-001",
          slug: "ada-demo-001",
          displayName: "Ada",
          role: "Builder",
          bio: "",
          interests: [],
          skills: [],
          projects: [],
          links: [],
          offers: "",
          seeking: "",
          goal: "hackathon",
          demo: true,
          presentation: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(
      await authActions(fakeStore(db)).claim("demo-001", {
        username: "adafresh",
        password: "Abcdef1!gh",
      }),
    ).toEqual({ error: "demo" });
  });
});
