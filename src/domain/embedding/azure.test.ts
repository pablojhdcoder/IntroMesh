import { describe, expect, it } from "vitest";
import { cosineDistance, cosineSimilarityUnit } from "./azure";

describe("cosineDistance (azure)", () => {
  it("scores unit vectors exactly", () => {
    expect(cosineDistance([1, 0], [1, 0])).toBeCloseTo(0);
    expect(cosineSimilarityUnit([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("throws on length mismatch instead of a silent partial dot", () => {
    expect(() => cosineDistance([1, 0], [1])).toThrow(/mismatch/);
    expect(() => cosineDistance(new Array(384).fill(0.05), new Array(1536).fill(0.02))).toThrow(/mismatch/);
  });
});
