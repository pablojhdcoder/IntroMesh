import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { claimExplanation, resolveExplanation } from "@/domain/cache/explanations";
import { E5_DIM, VECTOR_SEARCH_SQL, cosineDistance } from "@/domain/embedding/e5";
import { claimEmbedding, sameEmbedding, upsertEmbeddingJob, type EmbeddingRecord } from "@/domain/embedding/jobs";
import { canonicalContextText, canonicalGlobalText, explanationCacheKey, sha256, shouldNormalize } from "@/domain/identity/canonical";
import { cleanIdentity, groundIdentity, type StructuredIdentity } from "@/domain/identity/schema";
import { finalScore, retrieveBySimilarity, scorePair } from "@/domain/matching/hybrid";

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

describe("normalización", () => {
  it("no vuelve a llamar cuando el hash de la descripción sigue vigente", () => {
    const description = "I build AI products with founders.";
    expect(shouldNormalize({ inputHash: sha256(description.trim()), generated: identity }, description, false)).toBe(false);
    expect(shouldNormalize({ inputHash: sha256(description.trim()), generated: identity }, "Otra descripción distinta y larga.", false)).toBe(true);
    expect(shouldNormalize({ inputHash: sha256(description.trim()), generated: identity }, description, true)).toBe(true);
  });

  it("descarta habilidades que el texto no sostiene", () => {
    const grounded = groundIdentity(
      cleanIdentity({ ...identity, skills: ["Prototyping", "Quantum knitting"] }, "Ada"),
      "I am a software developer building AI products and prototyping with founders.",
    );
    expect(grounded.skills).toEqual(["Prototyping"]);
    expect(grounded.projects).toEqual([]);
  });
});

describe("embeddings", () => {
  it("la distancia de coseno es 1 menos el producto de vectores normalizados", () => {
    const left = [1, 0, 0];
    const right = [0, 1, 0];
    expect(E5_DIM).toBe(384);
    expect(cosineDistance(left, left)).toBeCloseTo(0);
    expect(cosineDistance(left, right)).toBeCloseTo(1);
    expect(VECTOR_SEARCH_SQL).toContain("<=>");
  });

  it("reutiliza el vector si el hash y la revisión no cambian y aísla el contexto", () => {
    const now = Date.parse("2026-10-30T12:00:00.000Z");
    const first = upsertEmbeddingJob(
      [],
      {
        kind: "global",
        userId: "u",
        eventId: null,
        inputHash: "h1",
        profileRevision: 1,
        modelId: "Xenova/multilingual-e5-small",
        modelRevision: "e5-query-symmetric-v1",
      },
      now,
    );
    const completed: EmbeddingRecord = { ...first.records[0], status: "completed", vector: [1] };
    expect(sameEmbedding(completed, "h1", 1)).toBe(true);
    const again = upsertEmbeddingJob([completed], {
      kind: "global",
      userId: "u",
      eventId: null,
      inputHash: "h1",
      profileRevision: 1,
      modelId: completed.modelId,
      modelRevision: completed.modelRevision,
    }, now);
    expect(again.action).toBe("reused");
    const madrid = canonicalContextText({ intent: "cofounders", lookingFor: ["founders"], eventName: "Madrid", eventCategory: "ai", eventDescription: "" });
    const lisbon = canonicalContextText({ intent: "cofounders", lookingFor: ["founders"], eventName: "Lisboa", eventCategory: "ai", eventDescription: "" });
    expect(sha256(madrid)).not.toBe(sha256(lisbon));
    expect(sha256(canonicalGlobalText(identity))).not.toBe(sha256(madrid));
  });

  it("recupera un trabajo abandonado y no pasa de un visor", () => {
    const now = Date.parse("2026-10-30T12:00:00.000Z");
    const scheduled = upsertEmbeddingJob([], {
      kind: "event",
      userId: "u",
      eventId: "e",
      inputHash: "h",
      profileRevision: 1,
      modelId: "Xenova/multilingual-e5-small",
      modelRevision: "v",
    }, now);
    const claimed = claimEmbedding(scheduled.records, now);
    expect(claimed.job?.status).toBe("processing");
    const abandoned = claimEmbedding(
      claimed.records.map((item) => ({ ...item, leaseUntil: new Date(now - 1000).toISOString() })),
      now,
    );
    expect(abandoned.job?.attempts).toBe(2);
    const ranked = retrieveBySimilarity([1, 0], [
      { item: { id: "a" }, vector: [1, 0] },
      { item: { id: "b" }, vector: [0, 1] },
      { item: { id: "c" }, vector: [0.6, 0.8] },
    ], 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.item.id).toBe("a");
  });
});

describe("ranking híbrido", () => {
  it("renormaliza cuando falta el contexto del evento", () => {
    const withContext = finalScore({ semantic: 1, goal: 0, skill: 0, interest: 0, event: 0 });
    const without = finalScore({ semantic: 1, goal: 0, skill: 0, interest: 0, event: null });
    expect(without.weights.event).toBeUndefined();
    expect(without.score).toBeGreaterThan(withContext.score);
  });

  it("puntúa complemento aunque no compartan intereses", () => {
    const scored = scorePair(
      {
        id: "a",
        interests: ["climate"],
        skills: ["design"],
        lookingFor: ["frontend"],
        canOffer: [],
        focus: [],
        projects: [],
        intent: "looking for frontend collaborators",
      },
      {
        id: "b",
        interests: ["hardware"],
        skills: ["frontend"],
        lookingFor: [],
        canOffer: ["frontend"],
        focus: [],
        projects: [],
        intent: "",
      },
      { name: "Hackathon", category: "ai", description: "builders" },
      { identity: null, context: null },
    );
    expect(scored.skillComplementarity).toBeGreaterThan(0);
    expect(scored.finalScore).toBeGreaterThan(0);
    expect(scored.identitySimilarity).toBeNull();
  });
});

describe("caché de explicaciones", () => {
  const draft = {
    id: "1",
    cacheKey: "k",
    eventId: "e",
    viewerId: "a",
    candidateId: "b",
    modelId: "muse-spark-1.3",
    promptVersion: "match-explain-v1",
    inputFingerprint: "f",
    createdAt: "2026-10-30T12:00:00.000Z",
  };

  it("abre una vez el modelo y las cinco siguientes salen de la caché", async () => {
    let calls = 0;
    let records: Parameters<typeof resolveExplanation>[0]["records"] = [];
    for (let index = 0; index < 6; index += 1) {
      const result = await resolveExplanation({
        records,
        draft,
        now: Date.parse("2026-10-30T12:00:00.000Z"),
        callModel: async () => {
          calls += 1;
          return { value: { summary: "Hecho declarado." }, usage: { input: 10, output: 4 } };
        },
      });
      records = result.records;
    }
    expect(calls).toBe(1);
    expect(records[0]?.status).toBe("completed");
    expect(records[0]?.tokenUsage).toEqual({ input: 10, output: 4 });
  });

  it("una reserva en curso no lanza otra llamada", () => {
    const now = Date.parse("2026-10-30T12:00:00.000Z");
    const first = claimExplanation([], draft, now);
    const second = claimExplanation(first.records, draft, now + 10);
    expect(first.outcome).toBe("claimed");
    expect(second.outcome).toBe("wait");
  });

  it("la clave es direccional", () => {
    const base = {
      eventId: "e",
      viewerRevision: 1,
      viewerHash: "a",
      candidateRevision: 1,
      candidateHash: "b",
      viewerContextRevision: 1,
      viewerContextHash: "c",
      candidateContextRevision: 1,
      candidateContextHash: "d",
      evidenceFingerprint: "s",
      rankingVersion: "hybrid-v1",
      promptVersion: "match-explain-v1",
      modelId: "muse-spark-1.3",
      locale: "es",
    };
    const forward = explanationCacheKey(base);
    const backward = explanationCacheKey({ ...base, viewerHash: "b", candidateHash: "a" });
    expect(forward).not.toBe(backward);
  });
});

describe("pgvector", () => {
  it("la migración crea el índice de coseno", () => {
    const sql = readFileSync("supabase/migrations/0003_intelligence.sql", "utf8");
    expect(sql).toContain("vector_cosine_ops");
    expect(sql).toContain("<=>");
    expect(sql).toContain("vector(384)");
  });
});
