import { describe, expect, it } from "vitest";
import { selectCandidates, type MatchProfile } from "./select-candidates";

const viewer: MatchProfile = {
  id: "me",
  displayName: "Ada",
  discoverable: true,
  goals: ["hire"],
  interests: ["models"],
  skills: ["product"],
};

function person(overrides: Partial<MatchProfile> & Pick<MatchProfile, "id">): MatchProfile {
  return {
    displayName: overrides.id,
    discoverable: true,
    goals: [],
    interests: [],
    skills: [],
    ...overrides,
  };
}

describe("selectCandidates", () => {
  it("excludes undiscoverable, self, and non-overlapping people", () => {
    const result = selectCandidates(viewer, [
      viewer,
      person({ id: "hidden", discoverable: false, goals: ["hire"] }),
      person({ id: "none", goals: ["invest"] }),
      person({ id: "match", goals: ["hire"], interests: ["models"] }),
    ]);

    expect(result.map((candidate) => candidate.profile.id)).toEqual(["match"]);
    expect(result[0]?.score).toBe(5);
  });

  it("ranks by score and breaks ties by id", () => {
    const result = selectCandidates(viewer, [
      person({ id: "b", skills: ["product"] }),
      person({ id: "a", skills: ["product"] }),
      person({ id: "strong", goals: ["hire"] }),
    ]);

    expect(result.map((candidate) => candidate.profile.id)).toEqual(["strong", "a", "b"]);
  });

  it("respects the reduced-set limit", () => {
    const pool = ["c", "b", "a"].map((id) => person({ id, skills: ["product"] }));
    expect(selectCandidates(viewer, pool, 2).map((candidate) => candidate.profile.id)).toEqual(["a", "b"]);
  });
});
