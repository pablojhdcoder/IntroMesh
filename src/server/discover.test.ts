import { describe, expect, it } from "vitest";
import { hydrateDatabase, type Database, type RecommendationRecord, type Store } from "@/lib/store/types";
import type { StoredProfile } from "@/domain/profile";
import { discoverActions, pointForPair } from "@/server/discover";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");
// Presence is evaluated against the real clock on the read path, so live
// fixtures stay relative to Date.now() instead of the fixed NOW above.
const liveAt = (): string => new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

function person(id: string, overrides: Partial<StoredProfile> = {}): StoredProfile {
  return {
    id,
    slug: id,
    displayName: id,
    role: "Builder",
    bio: "",
    interests: ["models"],
    skills: ["backend"],
    projects: [],
    links: [],
    offers: "",
    seeking: "",
    goal: "collaborate",
    demo: false,
    presentation: null,
    createdAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

function fakeStore(database: Database): Store {
  return {
    file: "test",
    read: () => Promise.resolve(database),
    update: <T>(mutator: (database: Database) => T | Promise<T>): Promise<T> =>
      Promise.resolve().then(() => mutator(database)),
  };
}

function livePresence(profileIds: string[], source: "session" | "demo" = "session", expiresAt = liveAt()) {
  return profileIds.map((profileId) => ({
    profileId,
    eventId: "e1",
    status: "active" as const,
    source,
    updatedAt: new Date(NOW).toISOString(),
    expiresAt,
  }));
}

function row(candidateId: string, finalScore: number): RecommendationRecord {
  return {
    eventId: "e1",
    viewerId: "viewer",
    candidateId,
    identitySimilarity: 0.9,
    contextSimilarity: 0.8,
    cosineDistance: 0.1,
    goalCompatibility: 1,
    skillComplementarity: 0.5,
    sharedInterests: 0.5,
    eventRelevance: null,
    finalScore,
    confidence: "high",
    sharedGoalLabels: ["Collaborate on a project"],
    sharedInterestLabels: ["models"],
    sharedSkillLabels: ["backend"],
    complementLabels: ["frontend"],
    rankingVersion: "hybrid-v1",
    viewerHash: "v",
    candidateHash: `c:${candidateId}`,
    viewerContextHash: "",
    candidateContextHash: "",
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
  };
}

function database(input: Partial<Database> = {}): Database {
  return hydrateDatabase({
    events: [
      {
        id: "e1",
        name: "E1",
        demo: false,
        description: "",
        category: "",
        startsAt: null,
        code: "E1",
        status: "live",
        createdBy: null,
      },
    ],
    ...input,
  });
}

describe("discover (read-only)", () => {
  it("never recomputes: recommendations stay empty and directory lists live others", async () => {
    const db = database({
      profiles: [person("viewer"), person("ana"), person("ben")],
      presence: livePresence(["viewer", "ana", "ben"]),
    });
    const result = await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(db.recommendations).toEqual([]);
    expect(result.people).toEqual([]);
    expect(result.viewerEmbeddingStatus).toBe("pending");
    expect(result.directory.map((item) => item.id).sort()).toEqual(["ana", "ben"]);
    expect(result.directory[0]).not.toHaveProperty("recommendation");
  });

  it("prunes expired presence for every source, demo included", async () => {
    const db = database({
      profiles: [person("viewer"), person("ghost")],
      presence: [
        ...livePresence(["viewer"]),
        ...livePresence(["ghost"], "demo", PAST),
      ],
    });
    await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect(db.presence.some((item) => item.profileId === "ghost")).toBe(false);
    expect(db.presence.some((item) => item.profileId === "viewer")).toBe(true);
  });

  it("returns empty rooms when the viewer is not live", async () => {
    const db = database({
      profiles: [person("viewer"), person("ana")],
      presence: livePresence(["ana"]),
      recommendations: [row("ana", 0.9)],
    });
    const result = await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.presence).toBe("invisible");
    expect(result.people).toEqual([]);
    expect(result.directory).toEqual([]);
  });

  it("serves persisted rows with stored labels, stable positions and no directory duplicates", async () => {
    const db = database({
      profiles: [person("viewer"), person("ana"), person("ben")],
      presence: livePresence(["viewer", "ana", "ben"]),
      recommendations: [row("ana", 0.9)],
      embeddings: [
        {
          id: "global:viewer:global",
          kind: "global",
          userId: "viewer",
          eventId: null,
          vector: [1, 0],
          modelId: "test",
          modelRevision: "v1",
          inputHash: "hash:viewer",
          profileRevision: 0,
          status: "completed",
          attempts: 0,
          leaseUntil: null,
          createdAt: new Date(NOW).toISOString(),
          updatedAt: new Date(NOW).toISOString(),
          error: null,
        },
      ],
    });
    const result = await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.viewerEmbeddingStatus).toBe("ready");
    expect(result.people).toHaveLength(1);
    const [entry] = result.people;
    expect(entry?.id).toBe("ana");
    expect(entry?.recommendation?.shared.interests).toEqual(["models"]);
    expect(entry?.recommendation?.shared.goals).toEqual(["Collaborate on a project"]);
    expect(entry?.recommendation?.complement).toEqual(["frontend"]);
    expect(entry?.recommendation?.confidence).toBe("high");
    expect(entry?.x).toBe(pointForPair("viewer", "ana").x);
    expect(entry?.y).toBe(pointForPair("viewer", "ana").y);
    expect(result.directory.map((item) => item.id)).toEqual(["ben"]);
  });

  it("reports pending while the global embedding job is claimed", async () => {
    const db = database({
      profiles: [person("viewer")],
      presence: livePresence(["viewer"]),
      embeddings: [
        {
          id: "global:viewer:global",
          kind: "global",
          userId: "viewer",
          eventId: null,
          vector: null,
          modelId: "test",
          modelRevision: "v1",
          inputHash: "hash:viewer",
          profileRevision: 0,
          status: "processing",
          attempts: 1,
          leaseUntil: new Date(Date.now() + 60_000).toISOString(),
          createdAt: new Date(NOW).toISOString(),
          updatedAt: new Date(NOW).toISOString(),
          error: null,
        },
      ],
    });
    const result = await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.viewerEmbeddingStatus).toBe("pending");
  });

  it("reports an unknown viewer", async () => {
    const db = database({ profiles: [person("viewer")], presence: livePresence(["viewer"]) });
    const result = await discoverActions(fakeStore(db)).discover("ghost", "e1");
    expect(result).toEqual({ error: "profile" });
  });
});
