import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hydrateDatabase, type Database, type RecommendationRecord, type Store } from "@/lib/store/types";
import type { StoredProfile } from "@/domain/profile";
import { explainActions } from "@/server/explain";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");
const KEY = "MODEL_API_KEY";
const previousKey = process.env[KEY];

beforeEach(() => {
  delete process.env[KEY];
});

afterEach(() => {
  if (previousKey === undefined) delete process.env[KEY];
  else process.env[KEY] = previousKey;
});

function person(id: string): StoredProfile {
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

function persistedRow(): RecommendationRecord {
  return {
    eventId: "e1",
    viewerId: "viewer",
    candidateId: "other",
    identitySimilarity: 0.9,
    contextSimilarity: 0.8,
    cosineDistance: 0.1,
    goalCompatibility: 1,
    skillComplementarity: 0.5,
    sharedInterests: 0.5,
    eventRelevance: null,
    finalScore: 0.8,
    confidence: "high",
    sharedGoalLabels: ["Collaborate on a project"],
    sharedInterestLabels: ["models"],
    sharedSkillLabels: ["backend"],
    complementLabels: ["frontend"],
    rankingVersion: "hybrid-v1",
    viewerHash: "v",
    candidateHash: "c",
    viewerContextHash: "",
    candidateContextHash: "",
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
  };
}

function joinedParticipation(userId: string) {
  return {
    userId,
    eventId: "e1",
    intentText: "meet builders",
    lookingFor: ["backend"],
    collaborationInterests: [] as string[],
    revision: 1,
    inputHash: `hash:${userId}`,
    consent: true,
    visibility: "discoverable" as const,
    status: "joined" as const,
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
    profiles: [person("viewer"), person("other")],
    participations: ["viewer", "other"].map(joinedParticipation),
    ...input,
  });
}

describe("affinity (membership-gated, real Meta only)", () => {
  it("returns a match error without a persisted recommendation row", async () => {
    const result = await explainActions(fakeStore(database())).affinity("viewer", "other", false, "e1");
    expect(result).toEqual({ error: "match" });
  });

  it("returns a meta error without a key instead of fabricating an explanation", async () => {
    const db = database({ recommendations: [persistedRow()] });
    const result = await explainActions(fakeStore(db)).affinity("viewer", "other", false, "e1");
    expect(result).toEqual({ error: "meta" });
  });

  it("works with zero presence rows when both sides are joined", async () => {
    const db = database({ recommendations: [persistedRow()] });
    expect(db).not.toHaveProperty("presence");
    const result = await explainActions(fakeStore(db)).affinity("viewer", "other", false, "e1");
    // No key is configured, so a fully gated pair surfaces the meta error —
    // never a presence error when both sides are joined.
    expect(result).toEqual({ error: "meta" });
  });

  it("still errors presence when the candidate is not joined", async () => {
    const db = database({
      recommendations: [persistedRow()],
      participations: [
        joinedParticipation("viewer"),
        { ...joinedParticipation("other"), status: "left" as const, consent: false, visibility: "hidden" as const },
      ],
    });
    const result = await explainActions(fakeStore(db)).affinity("viewer", "other", false, "e1");
    expect(result).toEqual({ error: "presence" });
  });

  it("still errors presence when the viewer never joined", async () => {
    const db = database({
      recommendations: [persistedRow()],
      participations: [joinedParticipation("other")],
    });
    const result = await explainActions(fakeStore(db)).affinity("viewer", "other", false, "e1");
    expect(result).toEqual({ error: "presence" });
  });

  it("ignores legacy consent/visibility columns: joined membership is enough", async () => {
    const db = database({
      recommendations: [persistedRow()],
      participations: [
        { ...joinedParticipation("viewer"), consent: false, visibility: "hidden" as const },
        { ...joinedParticipation("other"), consent: false, visibility: "hidden" as const },
      ],
    });
    const result = await explainActions(fakeStore(db)).affinity("viewer", "other", false, "e1");
    expect(result).toEqual({ error: "meta" });
  });

  it("reports unknown profiles", async () => {
    const result = await explainActions(fakeStore(database())).affinity("viewer", "ghost", false, "e1");
    expect(result).toEqual({ error: "profile" });
  });
});
