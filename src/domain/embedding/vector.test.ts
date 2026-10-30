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
  it("returns a fixed normalized vector", () => {
    const viewer = profile({ id: "me", goals: ["hire"], interests: ["models"], skills: ["product"] });
    const vector = embedProfile(viewer);
    expect(vector).toHaveLength(EMBEDDING_DIM);
    expect(Math.hypot(...vector)).toBeCloseTo(1, 5);
    expect(embedProfile(viewer)).toEqual(vector);
  });

  it("brings overlapping profiles closer and pushes others away", () => {
    const viewer = profile({ id: "me", goals: ["hire"], interests: ["models"], skills: ["product"] });
    const close = profile({ id: "close", goals: ["hire"], interests: ["models"] });
    const far = profile({ id: "far", goals: ["invest"], interests: ["hardware"], skills: ["finance"] });
    const origin = embedProfile(viewer);
    expect(cosineSimilarity(origin, embedProfile(viewer))).toBeCloseTo(1, 5);
    expect(cosineSimilarity(origin, embedProfile(close))).toBeGreaterThan(cosineSimilarity(origin, embedProfile(far)));
  });

  it("an empty profile does not fake closeness", () => {
    const viewer = profile({ id: "me", skills: ["product"] });
    const empty = profile({ id: "empty" });
    expect(embedProfile(empty).every((value) => value === 0)).toBe(true);
    expect(cosineSimilarity(embedProfile(viewer), embedProfile(empty))).toBe(0);
  });
});

describe("rankBySimilarity", () => {
  it("retrieves neighborhood above the threshold, sorted and capped", () => {
    const viewer = embedProfile(profile({ id: "me", interests: ["models"], skills: ["product"] }));
    const pool = [
      profile({ id: "b", interests: ["models"] }),
      profile({ id: "far", goals: ["invest"], skills: ["finance"] }),
      profile({ id: "a", interests: ["models"], skills: ["product"] }),
    ].map((item) => ({ item, vector: embedProfile(item) }));

    const ranked = rankBySimilarity(viewer, pool, { limit: 2, minSimilarity: 0.2 });
    expect(ranked.map((entry) => entry.item.id)).toEqual(["a", "b"]);
    expect(ranked[0]?.similarity).toBeGreaterThan(ranked[1]?.similarity ?? 0);
  });
});

describe("mapSignalGraph", () => {
  it("places closer neighbors nearer the center and stays stable", () => {
    const viewer = embedProfile(profile({ id: "me", interests: ["models"], skills: ["product"] }));
    const close = profile({ id: "close", interests: ["models"], skills: ["product"] });
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
