import { describe, expect, it } from "vitest";
import { openProfileId, sealProfileId } from "@/lib/session";
import { toSharedCard, type StoredProfile } from "./profile";
import { assertGrounded, type GroundedExplanation } from "./ground";
import { selectCandidates } from "./matching/select-candidates";

describe("grounding", () => {
  it("rejects an interest that is not in the evidence", () => {
    const explanation: GroundedExplanation = {
      source: "model",
      summary: "You both share models and also hardware.",
      opener: "Shall we talk about models?",
      citedGoals: [],
      citedInterests: ["models"],
      citedSkills: [],
      complement: [],
      confidence: "medium",
    };
    expect(assertGrounded(explanation, { goals: [], interests: ["models"], skills: [], complement: [] })).toBe(
      "unsupported-term",
    );
  });

  it("allows prose naming a candidate's own declared fact, while citations stay shared-only", () => {
    const explanation: GroundedExplanation = {
      source: "model",
      summary: "Their frontend work could pair with what you are exploring.",
      opener: "Ask how they approach frontend prototyping.",
      citedGoals: [],
      citedInterests: [],
      citedSkills: [],
      complement: [],
      confidence: "low",
    };
    expect(
      assertGrounded(
        explanation,
        { goals: [], interests: [], skills: [], complement: [] },
        ["frontend", "prototyping"],
      ),
    ).toBeNull();
    expect(
      assertGrounded(
        { ...explanation, citedSkills: ["frontend"] },
        { goals: [], interests: [], skills: [], complement: [] },
        ["frontend", "prototyping"],
      ),
    ).toBe("cited-skill");
  });

  it("model explanation only cites shared evidence, never fabricated demo text", () => {
    const explanation: GroundedExplanation = {
      source: "model",
      summary: "You both marked models.",
      opener: "What are you doing with models right now?",
      citedGoals: [],
      citedInterests: ["models"],
      citedSkills: [],
      complement: [],
      confidence: "low",
    };
    expect(assertGrounded(explanation, { goals: [], interests: ["models"], skills: [], complement: [] })).toBeNull();
    expect(explanation.source).toBe("model");
  });
});

describe("complement", () => {
  it("scores a skill the other has that you are seeking", () => {
    const [match] = selectCandidates(
      {
        id: "me",
        displayName: "Me",
        discoverable: true,
        goals: ["hackathon"],
        interests: [],
        skills: [],
        seeking: "looking for frontend for the prototype",
      },
      [
        {
          id: "other",
          displayName: "Ada",
          discoverable: true,
          goals: [],
          interests: [],
          skills: ["frontend"],
        },
      ],
    );
    expect(match?.complement).toEqual(["frontend"]);
    expect(match?.score).toBe(2);
  });
});

describe("session and shared card", () => {
  it("rejects an unsigned profile id", () => {
    const token = sealProfileId("user-1", "secret");
    expect(openProfileId(token, "secret")).toBe("user-1");
    expect(openProfileId("user-1", "secret")).toBeNull();
    expect(openProfileId(token, "other")).toBeNull();
  });

  it("shared card omits seeking and offers", () => {
    const profile: StoredProfile = {
      id: "user-1",
      slug: "ada",
      displayName: "Ada",
      role: "Design",
      bio: "private",
      interests: ["design"],
      skills: ["frontend"],
      projects: [],
      links: [{ label: "Web", url: "https://example.com" }],
      offers: "mentoring",
      seeking: "a cofounder",
      goal: "hackathon",
      demo: false,
      presentation: null,
      createdAt: "2026-11-04T00:00:00.000Z",
    };
    const card = toSharedCard(profile);
    expect(card).not.toHaveProperty("seeking");
    expect(card).not.toHaveProperty("offers");
    expect(card).not.toHaveProperty("links");
    expect(card).not.toHaveProperty("bio");
  });
});
