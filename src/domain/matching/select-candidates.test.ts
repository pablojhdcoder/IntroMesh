import { describe, expect, it } from "vitest";
import { selectCandidates, type MatchProfile } from "./select-candidates";

const viewer: MatchProfile = {
  id: "me",
  displayName: "Ada",
  discoverable: true,
  goals: ["contratar"],
  interests: ["modelos"],
  skills: ["producto"],
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
  it("excluye a quien no consintió, al propio perfil y a quien no comparte atributos", () => {
    const result = selectCandidates(viewer, [
      viewer,
      person({ id: "hidden", discoverable: false, goals: ["contratar"] }),
      person({ id: "none", goals: ["invertir"] }),
      person({ id: "match", goals: ["contratar"], interests: ["modelos"] }),
    ]);

    expect(result.map((candidate) => candidate.profile.id)).toEqual(["match"]);
    expect(result[0]?.score).toBe(5);
  });

  it("ordena por puntuación y desempata por id", () => {
    const result = selectCandidates(viewer, [
      person({ id: "b", skills: ["producto"] }),
      person({ id: "a", skills: ["producto"] }),
      person({ id: "strong", goals: ["contratar"] }),
    ]);

    expect(result.map((candidate) => candidate.profile.id)).toEqual(["strong", "a", "b"]);
  });

  it("respeta el límite del conjunto reducido", () => {
    const pool = ["c", "b", "a"].map((id) => person({ id, skills: ["producto"] }));
    expect(selectCandidates(viewer, pool, 2).map((candidate) => candidate.profile.id)).toEqual(["a", "b"]);
  });
});
