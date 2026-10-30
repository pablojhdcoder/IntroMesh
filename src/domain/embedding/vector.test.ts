import { describe, expect, it } from "vitest";
import type { MatchProfile } from "@/domain/matching/select-candidates";
import { mapSignalGraph } from "./graph-map";
import { cosineSimilarity, embedProfile, EMBEDDING_DIM, rankBySimilarity } from "./vector";

function profile(overrides: Partial<MatchProfile> & Pick<MatchProfile, "id">): MatchProfile {
  return {
    displayName: overrides.id,
    discoverable: true,
    goals: [],
    interests: [],
    skills: [],
    ...overrides,
  };
}

describe("embedProfile", () => {
  it("devuelve un vector fijo y normalizado", () => {
    const viewer = profile({ id: "me", goals: ["contratar"], interests: ["modelos"], skills: ["producto"] });
    const vector = embedProfile(viewer);
    expect(vector).toHaveLength(EMBEDDING_DIM);
    expect(Math.hypot(...vector)).toBeCloseTo(1, 5);
    expect(embedProfile(viewer)).toEqual(vector);
  });

  it("acerca perfiles que comparten atributos y aleja los que no", () => {
    const viewer = profile({ id: "me", goals: ["contratar"], interests: ["modelos"], skills: ["producto"] });
    const close = profile({ id: "close", goals: ["contratar"], interests: ["modelos"] });
    const far = profile({ id: "far", goals: ["invertir"], interests: ["hardware"], skills: ["finanzas"] });
    const origin = embedProfile(viewer);
    expect(cosineSimilarity(origin, embedProfile(viewer))).toBeCloseTo(1, 5);
    expect(cosineSimilarity(origin, embedProfile(close))).toBeGreaterThan(cosineSimilarity(origin, embedProfile(far)));
  });

  it("un perfil vacío no finge cercanía", () => {
    const viewer = profile({ id: "me", skills: ["producto"] });
    const empty = profile({ id: "empty" });
    expect(embedProfile(empty).every((value) => value === 0)).toBe(true);
    expect(cosineSimilarity(embedProfile(viewer), embedProfile(empty))).toBe(0);
  });
});

describe("rankBySimilarity", () => {
  it("recupera el vecindario por encima del umbral, ordenado y acotado", () => {
    const viewer = embedProfile(profile({ id: "me", interests: ["modelos"], skills: ["producto"] }));
    const pool = [
      profile({ id: "b", interests: ["modelos"] }),
      profile({ id: "far", goals: ["invertir"], skills: ["finanzas"] }),
      profile({ id: "a", interests: ["modelos"], skills: ["producto"] }),
    ].map((item) => ({ item, vector: embedProfile(item) }));

    const ranked = rankBySimilarity(viewer, pool, { limit: 2, minSimilarity: 0.2 });
    expect(ranked.map((entry) => entry.item.id)).toEqual(["a", "b"]);
    expect(ranked[0]?.similarity).toBeGreaterThan(ranked[1]?.similarity ?? 0);
  });
});

describe("mapSignalGraph", () => {
  it("coloca más cerca del centro a quien más se parece y es estable", () => {
    const viewer = embedProfile(profile({ id: "me", interests: ["modelos"], skills: ["producto"] }));
    const close = profile({ id: "close", interests: ["modelos"], skills: ["producto"] });
    const far = profile({ id: "far", goals: ["otro"], skills: ["distinto"] });
    const nodes = [far, close].map((item) => ({
      id: item.id,
      vector: embedProfile(item),
      similarity: cosineSimilarity(viewer, embedProfile(item)),
    }));

    const mapped = mapSignalGraph(nodes);
    const again = mapSignalGraph([...nodes].reverse());
    expect(again).toEqual(mapped);

    const distance = (id: string) => {
      const point = mapped.find((item) => item.id === id);
      if (!point) throw new Error(id);
      return Math.hypot(point.x - 50, (point.y - 50) / 0.82);
    };
    expect(distance("close")).toBeLessThan(distance("far"));
    expect(new Set(mapped.map((point) => `${point.x},${point.y}`)).size).toBe(2);
  });
});
