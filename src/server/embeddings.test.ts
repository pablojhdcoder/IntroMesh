import { describe, expect, it } from "vitest";
import { EMBEDDING_DIM } from "@/domain/embedding/azure";
import { canonicalGlobalText, sha256 } from "@/domain/identity/canonical";
import type { StructuredIdentity } from "@/domain/identity/schema";
import { hydrateDatabase, type Database, type Store } from "@/lib/store/types";
import { processEmbeddingJob, processEmbeddingQueue, recomputeAfterEmbedding } from "@/server/embeddings";
import { onboardingActions } from "@/server/onboarding";
import { scheduleEmbedding } from "@/server/recommendations";

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

function unitVector(): number[] {
  return Array.from({ length: EMBEDDING_DIM }, () => 1 / Math.sqrt(EMBEDDING_DIM));
}

function mockEmbed() {
  const calls: string[] = [];
  const embed = async (text: string): Promise<number[]> => {
    calls.push(text);
    return unitVector();
  };
  return { calls, embed };
}

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
    ],
    profiles: [
      {
        id: "u1",
        slug: "u1",
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
  });
}

describe("processEmbeddingJob (inline single job)", () => {
  it("completes the confirm→schedule→embed chain with a mocked model", async () => {
    const database = baseDatabase();
    // Reset to a draft so confirmIdentity drives the schedule, like the route.
    const stored = database.identities.find((item) => item.userId === "u1");
    if (stored) {
      stored.status = "generated";
      stored.confirmed = null;
    }
    const store = fakeStore(database);
    const saved = await onboardingActions(store).confirmIdentity("u1", identity);
    expect(saved).not.toHaveProperty("error");
    const job = database.embeddings.find((item) => item.kind === "global" && item.userId === "u1");
    expect(job?.status).toBe("pending");

    const { calls, embed } = mockEmbed();
    const finished = await processEmbeddingJob(store, job?.id ?? "", embed, NOW);
    expect(finished?.kind).toBe("global");
    // The enqueued text carries no legacy prefix: the provider swap changed hashes.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.startsWith("query: ")).toBe(false);
    expect(calls[0]).toBe(canonicalGlobalText(identity));
    const stored2 = database.embeddings.find((item) => item.id === job?.id);
    expect(stored2?.status).toBe("completed");
    expect(stored2?.vector).toHaveLength(EMBEDDING_DIM);
    expect(database.metrics.embeddingsGenerated).toBe(1);
  });

  it("completes the join→schedule→embed chain with recompute", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const joined = await onboardingActions(store).joinEvent("u1", "e1", "Meet builders");
    expect(joined).not.toHaveProperty("error");
    const job = database.embeddings.find(
      (item) => item.kind === "event" && item.userId === "u1" && item.eventId === "e1",
    );
    expect(job?.status).toBe("pending");

    const { calls, embed } = mockEmbed();
    const finished = await processEmbeddingJob(store, job?.id ?? "", embed, NOW);
    expect(finished?.kind).toBe("event");
    expect(calls).toHaveLength(1);
    expect(database.embeddings.find((item) => item.id === job?.id)?.status).toBe("completed");
  });

  it("marks an old-provider job stale without calling the model", async () => {
    const database = baseDatabase();
    scheduleEmbedding(
      database,
      {
        kind: "global",
        userId: "u1",
        eventId: null,
        text: canonicalGlobalText(identity),
        revision: 1,
        // Force the legacy provider identity onto the row.
      },
      NOW,
    );
    const job = database.embeddings.find((item) => item.kind === "global" && item.userId === "u1");
    if (job) {
      job.modelId = "legacy-local-small";
      job.modelRevision = "legacy-revision-v0";
    }
    const store = fakeStore(database);
    const { calls, embed } = mockEmbed();
    const finished = await processEmbeddingJob(store, job?.id ?? "", embed, NOW);
    expect(finished).toBeNull();
    expect(calls).toHaveLength(0);
    const stored = database.embeddings.find((item) => item.id === job?.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.error).toMatch(/stale model/);
  });

  it("marks a hash-mismatched job stale without calling the model", async () => {
    const database = baseDatabase();
    scheduleEmbedding(
      database,
      { kind: "global", userId: "u1", eventId: null, text: canonicalGlobalText(identity), revision: 1 },
      NOW,
    );
    // Identity edited after scheduling: the queued hash no longer holds.
    const stored = database.identities.find((item) => item.userId === "u1");
    if (stored?.confirmed) stored.confirmed = { ...stored.confirmed, short_bio: "Builds robots." };
    const store = fakeStore(database);
    const { calls, embed } = mockEmbed();
    const job = database.embeddings.find((item) => item.kind === "global" && item.userId === "u1");
    const finished = await processEmbeddingJob(store, job?.id ?? "", embed, NOW);
    expect(finished).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("returns null for unknown, completed, or leased jobs", async () => {
    const database = baseDatabase();
    const store = fakeStore(database);
    const { embed } = mockEmbed();
    expect(await processEmbeddingJob(store, "missing", embed, NOW)).toBeNull();
    scheduleEmbedding(
      database,
      { kind: "global", userId: "u1", eventId: null, text: canonicalGlobalText(identity), revision: 1 },
      NOW,
    );
    const job = database.embeddings.find((item) => item.kind === "global" && item.userId === "u1");
    const first = await processEmbeddingJob(store, job?.id ?? "", embed, NOW);
    expect(first?.kind).toBe("global");
    // Completed rows are never re-claimed by id.
    expect(await processEmbeddingJob(store, job?.id ?? "", embed, NOW)).toBeNull();
  });
});

describe("queue drain + recompute stay shared", () => {
  it("drains pending jobs and recomputes via the shared function", async () => {
    const database = baseDatabase();
    scheduleEmbedding(
      database,
      { kind: "global", userId: "u1", eventId: null, text: canonicalGlobalText(identity), revision: 1 },
      NOW,
    );
    const store = fakeStore(database);
    const { embed } = mockEmbed();
    const { count, completed } = await processEmbeddingQueue(store, embed, NOW);
    expect(count).toBe(1);
    expect(completed).toHaveLength(1);
    const touched = await recomputeAfterEmbedding(store, completed[0]!);
    expect(typeof touched).toBe("number");
    // A second drain finds nothing claimable.
    const again = await processEmbeddingQueue(store, embed, NOW);
    expect(again.count).toBe(0);
  });

  it("marks stale-model rows failed without burning an attempt", async () => {
    const database = baseDatabase();
    scheduleEmbedding(
      database,
      { kind: "global", userId: "u1", eventId: null, text: canonicalGlobalText(identity), revision: 1 },
      NOW,
    );
    const job = database.embeddings.find((item) => item.kind === "global" && item.userId === "u1");
    if (job) {
      job.modelId = "legacy-local-small";
      job.modelRevision = "legacy-revision-v0";
    }
    expect(job?.attempts).toBe(0);
    const store = fakeStore(database);
    const { calls, embed } = mockEmbed();
    const finished = await processEmbeddingJob(store, job?.id ?? "", embed, NOW);
    expect(finished).toBeNull();
    expect(calls).toHaveLength(0);
    const stored = database.embeddings.find((item) => item.id === job?.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.attempts).toBe(0);
    expect(stored?.error).toMatch(/stale model/);
  });

  it("queue drain settles stale rows without looping or burning attempts", async () => {
    const database = baseDatabase();
    scheduleEmbedding(
      database,
      { kind: "global", userId: "u1", eventId: null, text: canonicalGlobalText(identity), revision: 1 },
      NOW,
    );
    const job = database.embeddings.find((item) => item.kind === "global" && item.userId === "u1");
    if (job) {
      job.modelId = "legacy-local-small";
      job.modelRevision = "legacy-revision-v0";
    }
    const store = fakeStore(database);
    const { calls, embed } = mockEmbed();
    const { count } = await processEmbeddingQueue(store, embed, NOW);
    expect(count).toBe(0);
    expect(calls).toHaveLength(0);
    const stored = database.embeddings.find((item) => item.id === job?.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.attempts).toBe(0);
  });

  it("counts retries only for retryable transport failures", async () => {
    const retryable = baseDatabase();
    scheduleEmbedding(
      retryable,
      { kind: "global", userId: "u1", eventId: null, text: canonicalGlobalText(identity), revision: 1 },
      NOW,
    );
    const retryStore = fakeStore(retryable);
    const rJob = retryable.embeddings.find((item) => item.kind === "global" && item.userId === "u1");
    const failingRetryable = async (): Promise<number[]> => {
      throw new Error("azure embedding request failed with status 500 body: boom");
    };
    expect(await processEmbeddingJob(retryStore, rJob?.id ?? "", failingRetryable, NOW)).toBeNull();
    expect(retryable.metrics.failures).toBe(1);
    expect(retryable.metrics.retries).toBe(1);

    const terminal = baseDatabase();
    scheduleEmbedding(
      terminal,
      { kind: "global", userId: "u1", eventId: null, text: canonicalGlobalText(identity), revision: 1 },
      NOW,
    );
    const terminalStore = fakeStore(terminal);
    const tJob = terminal.embeddings.find((item) => item.kind === "global" && item.userId === "u1");
    const failingTerminal = async (): Promise<number[]> => {
      throw new Error("azure embedding request failed with status 400 body: bad request");
    };
    expect(await processEmbeddingJob(terminalStore, tJob?.id ?? "", failingTerminal, NOW)).toBeNull();
    expect(terminal.metrics.failures).toBe(1);
    expect(terminal.metrics.retries).toBe(0);
  });
});
