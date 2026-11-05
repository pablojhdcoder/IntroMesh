import { describe, expect, it } from "vitest";
import { hydrateDatabase, type Database } from "@/lib/store/types";
import { AZURE_EMBEDDING_MODEL_ID, AZURE_EMBEDDING_REVISION, EMBEDDING_DIM } from "@/domain/embedding/azure";
import type { StoredProfile } from "@/domain/profile";
import { insertCandidateAgainstViewers, recomputeViewerOnEmbedding } from "@/server/recompute";
import { buildRecommendationIndex, refreshViewerRecommendations } from "@/server/recommendations";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");

function person(id: string, interests: string[]): StoredProfile {
  return {
    id,
    slug: id,
    displayName: id,
    role: "Builder",
    bio: "",
    interests,
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

function database(): Database {
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
    profiles: [person("viewer", ["models", "data"]), person("ana", ["models"]), person("ben", ["data"])],
    participations: ["viewer", "ana", "ben"].map(joinedParticipation),
  });
}

function joinedParticipation(userId: string) {
  return {
    userId,
    eventId: "e1",
    intentText: "",
    lookingFor: ["backend"],
    collaborationInterests: [] as string[],
    revision: 0,
    inputHash: `hash:${userId}`,
    consent: true,
    visibility: "discoverable" as const,
    status: "joined" as const,
    updatedAt: new Date(NOW).toISOString(),
  };
}

describe("refreshViewerRecommendations", () => {
  it("recalculates once, then reports a steady room as fresh", () => {
    const db = database();
    expect(refreshViewerRecommendations(db, "viewer", "e1", NOW)).toBe(true);
    const stored = JSON.stringify(db.recommendations);
    expect(db.recommendations.length).toBeGreaterThan(0);
    expect(refreshViewerRecommendations(db, "viewer", "e1", NOW)).toBe(false);
    expect(JSON.stringify(db.recommendations)).toBe(stored);
  });

  it("recalculates when a candidate changes", () => {
    const db = database();
    expect(refreshViewerRecommendations(db, "viewer", "e1", NOW)).toBe(true);
    const candidate = db.profiles.find((item) => item.id === "ana");
    candidate?.interests.push("hardware");
    expect(refreshViewerRecommendations(db, "viewer", "e1", NOW)).toBe(true);
  });

  it("does nothing without event or viewer", () => {
    const db = database();
    expect(refreshViewerRecommendations(db, "ghost", "e1", NOW)).toBe(false);
    expect(refreshViewerRecommendations(db, "viewer", "nope", NOW)).toBe(false);
    expect(db.recommendations).toEqual([]);
  });
});

describe("evidence labels", () => {
  function labeled(): Database {
    const db = database();
    const viewer = db.profiles.find((item) => item.id === "viewer");
    if (viewer) {
      viewer.interests = ["models", "data"];
      viewer.skills = ["backend"];
      viewer.seeking = "frontend";
    }
    const ana = db.profiles.find((item) => item.id === "ana");
    if (ana) {
      ana.interests = ["models", "climate"];
      ana.skills = ["frontend", "backend"];
    }
    return db;
  }

  it("derives labels from token overlap between free-text and catalog profiles", () => {
    const db = database();
    const viewer = db.profiles.find((item) => item.id === "viewer");
    const ana = db.profiles.find((item) => item.id === "ana");
    if (viewer) {
      viewer.interests = ["field research", "long walks"];
      viewer.skills = ["writing"];
      viewer.seeking = "designer who loves field research";
      viewer.goal = "hackathon";
    }
    if (ana) {
      ana.interests = ["research"];
      ana.skills = ["research"];
      ana.goal = "hackathon";
    }
    expect(refreshViewerRecommendations(db, "viewer", "e1", NOW)).toBe(true);
    const row = db.recommendations.find((item) => item.candidateId === "ana");
    expect(row).toBeDefined();
    expect(row?.sharedInterestLabels).toContain("research");
    expect(row?.complementLabels).toContain("research");
  });

  it("does not persist a scored candidate with no citable evidence and no identity similarity", () => {
    const db = database();
    const viewer = db.profiles.find((item) => item.id === "viewer");
    const ana = db.profiles.find((item) => item.id === "ana");
    if (viewer) {
      viewer.interests = ["astrophysics"];
      viewer.skills = ["writing"];
      viewer.seeking = "astrophysics mentoring";
      viewer.goal = "hackathon";
    }
    if (ana) {
      ana.interests = ["cooking"];
      ana.skills = ["cooking"];
      ana.offers = "astrophysics mentoring";
      ana.goal = "cofounder";
    }
    refreshViewerRecommendations(db, "viewer", "e1", NOW);
    expect(db.recommendations.some((item) => item.candidateId === "ana")).toBe(false);
  });

  it("populates shared and complement labels from the scored pair", () => {
    const db = labeled();
    expect(refreshViewerRecommendations(db, "viewer", "e1", NOW)).toBe(true);
    const row = db.recommendations.find((item) => item.candidateId === "ana");
    expect(row).toBeDefined();
    expect(row?.sharedInterestLabels).toContain("models");
    expect(row?.sharedSkillLabels).toContain("backend");
    expect(row?.sharedGoalLabels).toEqual(["Collaborate on a project"]);
    expect(row?.complementLabels).toContain("frontend");
    expect(row?.complementLabels).not.toContain("backend");
  });
});

describe("write-path recompute", () => {
  const TOPICS = ["topic1", "topic2", "topic3", "topic4", "topic5", "topic6", "topic7", "topic8", "topic9"];

  function ranked(): Database {
    const profiles: StoredProfile[] = [
      {
        id: "viewer",
        slug: "viewer",
        displayName: "viewer",
        role: "Builder",
        bio: "",
        interests: TOPICS,
        skills: [],
        projects: [],
        links: [],
        offers: "",
        seeking: "",
        goal: "collaborate",
        demo: false,
        presentation: null,
        createdAt: new Date(NOW).toISOString(),
      },
      ...TOPICS.map((_, index) => {
        const id = `c${index + 1}`;
        return {
          id,
          slug: id,
          displayName: id,
          role: "Builder",
          bio: "",
          interests: TOPICS.slice(0, index + 1),
          skills: [],
          projects: [],
          links: [],
          offers: "",
          seeking: "",
          goal: "collaborate",
          demo: false,
          presentation: null,
          createdAt: new Date(NOW).toISOString(),
        };
      }),
    ];
    const ids = profiles.map((item) => item.id);
    const unit = Array.from({ length: EMBEDDING_DIM }, () => 1 / Math.sqrt(EMBEDDING_DIM));
    const db = hydrateDatabase({
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
      profiles,
      participations: ids.map(joinedParticipation),
      embeddings: ids.map((userId) => ({
        id: `global:${userId}:global`,
        kind: "global" as const,
        userId,
        eventId: null,
        vector: [...unit],
        modelId: AZURE_EMBEDDING_MODEL_ID,
        modelRevision: AZURE_EMBEDDING_REVISION,
        inputHash: `hash:${userId}`,
        profileRevision: 0,
        status: "completed" as const,
        attempts: 0,
        leaseUntil: null,
        createdAt: new Date(NOW).toISOString(),
        updatedAt: new Date(NOW).toISOString(),
        error: null,
      })),
    });
    return db;
  }

  it("recomputeViewerOnEmbedding persists the top-8 sorted by score", () => {
    const db = ranked();
    expect(recomputeViewerOnEmbedding(db, "viewer", "e1", NOW)).toBe(true);
    const rows = db.recommendations.filter((item) => item.viewerId === "viewer");
    expect(rows).toHaveLength(8);
    const scores = rows.map((item) => item.finalScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(rows[0]?.candidateId).toBe("c9");
  });

  it("insertCandidateAgainstViewers evicts the lowest row to keep the top-8 sorted", () => {
    const db = ranked();
    expect(recomputeViewerOnEmbedding(db, "viewer", "e1", NOW)).toBe(true);
    expect(
      db.recommendations.some((item) => item.viewerId === "viewer" && item.candidateId === "c1"),
    ).toBe(false);
    // No presence rows anywhere: membership alone drives the insert.
    expect(db).not.toHaveProperty("presence");
    db.profiles.push({
      id: "newcomer",
      slug: "newcomer",
      displayName: "newcomer",
      role: "Builder",
      bio: "",
      interests: TOPICS,
      skills: [],
      projects: [],
      links: [],
      offers: "",
      seeking: "",
      goal: "collaborate",
      demo: false,
      presentation: null,
      createdAt: new Date(NOW).toISOString(),
    });
    db.participations.push(joinedParticipation("newcomer"));
    db.embeddings.push({
      id: "global:newcomer:global",
      kind: "global",
      userId: "newcomer",
      eventId: null,
      vector: Array.from({ length: EMBEDDING_DIM }, () => 1 / Math.sqrt(EMBEDDING_DIM)),
      modelId: AZURE_EMBEDDING_MODEL_ID,
      modelRevision: AZURE_EMBEDDING_REVISION,
      inputHash: "hash:newcomer",
      profileRevision: 0,
      status: "completed",
      attempts: 0,
      leaseUntil: null,
      createdAt: new Date(NOW).toISOString(),
      updatedAt: new Date(NOW).toISOString(),
      error: null,
    });
    // Every live viewer with a vector scores the newcomer once: viewer + c1..c9.
    expect(insertCandidateAgainstViewers(db, "newcomer", "e1", NOW)).toBe(10);
    const rows = db.recommendations
      .filter((item) => item.viewerId === "viewer")
      .sort((a, b) => b.finalScore - a.finalScore || a.candidateId.localeCompare(b.candidateId));
    expect(rows).toHaveLength(8);
    expect(rows[0]?.candidateId).toBe("c9");
    expect(rows.some((item) => item.candidateId === "newcomer")).toBe(true);
    expect(rows.some((item) => item.candidateId === "c2")).toBe(false);
    const scores = rows.map((item) => item.finalScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("insertCandidateAgainstViewers ignores unknown candidates and events", () => {
    const db = ranked();
    expect(insertCandidateAgainstViewers(db, "ghost", "e1", NOW)).toBe(0);
    expect(insertCandidateAgainstViewers(db, "viewer", "nope", NOW)).toBe(0);
    expect(db.recommendations).toEqual([]);
  });
});

describe("stale-provider vectors never score", () => {
  function completedRow(overrides: {
    id: string;
    userId: string;
    vector: number[];
    modelId: string;
    modelRevision: string;
  }) {
    return {
      ...overrides,
      kind: "global" as const,
      eventId: null,
      inputHash: `hash:${overrides.userId}`,
      profileRevision: 0,
      status: "completed" as const,
      attempts: 0,
      leaseUntil: null,
      createdAt: new Date(NOW).toISOString(),
      updatedAt: new Date(NOW).toISOString(),
      error: null,
    };
  }

  it("skips legacy-revision and wrong-dim completed rows in the index", () => {
    const db = database();
    const good = Array.from({ length: EMBEDDING_DIM }, () => 1 / Math.sqrt(EMBEDDING_DIM));
    db.embeddings.push(
      completedRow({
        id: "global:viewer:global",
        userId: "viewer",
        vector: good,
        modelId: AZURE_EMBEDDING_MODEL_ID,
        modelRevision: AZURE_EMBEDDING_REVISION,
      }),
      completedRow({
        id: "global:ana:global",
        userId: "ana",
        vector: good,
        modelId: "legacy-local-small",
        modelRevision: "legacy-revision-v0",
      }),
      completedRow({
        id: "global:ben:global",
        userId: "ben",
        vector: [1, 0],
        modelId: AZURE_EMBEDDING_MODEL_ID,
        modelRevision: AZURE_EMBEDDING_REVISION,
      }),
    );
    const index = buildRecommendationIndex(db);
    expect(index.globalVectorByUser.get("viewer")).toEqual(good);
    expect(index.globalVectorByUser.has("ana")).toBe(false);
    expect(index.globalVectorByUser.has("ben")).toBe(false);
  });
});
