import { describe, expect, it } from "vitest";
import { hydrateDatabase, type Database, type RecommendationRecord, type Store } from "@/lib/store/types";
import type { StoredProfile } from "@/domain/profile";
import { discoverActions, pointForPair } from "@/server/discover";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");

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

function joinedParticipation(userId: string) {
  return {
    userId,
    eventId: "e1",
    intentText: "",
    lookingFor: [],
    collaborationInterests: [],
    revision: 1,
    inputHash: "hash",
    consent: true,
    visibility: "discoverable" as const,
    status: "joined" as const,
    updatedAt: new Date(NOW).toISOString(),
  };
}

describe("discover (membership visibility, read-only)", () => {
  it("shows joined members with zero presence rows in the database", async () => {
    const db = database({
      profiles: [person("viewer"), person("ana"), person("ben")],
      participations: ["viewer", "ana", "ben"].map(joinedParticipation),
    });
    expect(db).not.toHaveProperty("presence");
    const result = await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(db.recommendations).toEqual([]);
    expect(result.people).toEqual([]);
    expect(result.viewerEmbeddingStatus).toBe("pending");
    expect(result.directory.map((item) => item.id).sort()).toEqual(["ana", "ben"]);
    expect(result.directory[0]).not.toHaveProperty("recommendation");
    expect(result).not.toHaveProperty("presence");
  });

  it("is a zero-write path: the database is untouched by discovery", async () => {
    const db = database({
      profiles: [person("viewer"), person("ana")],
      participations: ["viewer", "ana"].map(joinedParticipation),
    });
    const before = JSON.stringify(db);
    await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect(JSON.stringify(db)).toBe(before);
  });

  it("returns empty rooms when the viewer is not joined", async () => {
    const db = database({
      profiles: [person("viewer"), person("ana")],
      participations: [joinedParticipation("ana")],
      recommendations: [row("ana", 0.9)],
    });
    const result = await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.event?.id).toBe("e1");
    expect(result.people).toEqual([]);
    expect(result.directory).toEqual([]);
    expect(result).not.toHaveProperty("presence");
  });

  it("serves persisted rows with stored labels, stable positions and no directory duplicates", async () => {
    const db = database({
      profiles: [person("viewer"), person("ana"), person("ben")],
      participations: ["viewer", "ana", "ben"].map(joinedParticipation),
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
    expect(entry).not.toHaveProperty("presence");
    expect(result.directory.map((item) => item.id)).toEqual(["ben"]);
  });

  it("excludes left candidates from people and directory", async () => {
    const db = database({
      profiles: [person("viewer"), person("ana"), person("ben")],
      participations: [
        joinedParticipation("viewer"),
        { ...joinedParticipation("ana"), status: "left" as const, consent: false, visibility: "hidden" as const },
        joinedParticipation("ben"),
      ],
      recommendations: [row("ana", 0.9), row("ben", 0.8)],
    });
    const result = await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.people.map((item) => item.id)).toEqual(["ben"]);
    expect(result.directory).toEqual([]);
  });

  it("sorts the directory by displayName and caps it at 100", async () => {
    const members = Array.from({ length: 105 }, (_, index) => `m${String(index).padStart(3, "0")}`);
    const db = database({
      profiles: [
        person("viewer", { displayName: "Viewer" }),
        ...members.map((id, index) => person(id, { displayName: `Name ${String(104 - index).padStart(3, "0")}` })),
      ],
      participations: ["viewer", ...members].map(joinedParticipation),
    });
    const result = await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.directory).toHaveLength(100);
    const names = result.directory.map((item) => item.displayName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names[0]).toBe("Name 000");
  });

  it("reports pending while the global embedding job is claimed", async () => {
    const db = database({
      profiles: [person("viewer")],
      participations: ["viewer"].map(joinedParticipation),
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
    const db = database({
      profiles: [person("viewer")],
      participations: ["viewer"].map(joinedParticipation),
    });
    const result = await discoverActions(fakeStore(db)).discover("ghost", "e1");
    expect(result).toEqual({ error: "profile" });
  });

  it("directory carries shared cards only: no presence, no recommendation, no position", async () => {
    const db = database({
      profiles: [person("viewer"), person("ana", { displayName: "Ana" })],
      participations: ["viewer", "ana"].map(joinedParticipation),
    });
    const result = await discoverActions(fakeStore(db)).discover("viewer", "e1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.directory).toHaveLength(1);
    expect(result.directory[0]).not.toHaveProperty("presence");
    expect(result.directory[0]).not.toHaveProperty("recommendation");
    expect(result.directory[0]).not.toHaveProperty("x");
    expect(result.directory[0]).not.toHaveProperty("y");
  });
});
