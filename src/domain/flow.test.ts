import { describe, expect, it } from "vitest";
import { openProfileId, sealProfileId } from "@/lib/session";
import { toSharedCard, type StoredProfile } from "./profile";
import { aggregateActivity } from "./analytics";
import { assertGrounded, demoExplanation, type GroundedExplanation } from "./ground";
import { isPresenceLive, nextExpiry } from "./presence";
import { selectCandidates } from "./matching/select-candidates";

describe("presence", () => {
  it("expires an abandoned heartbeat", () => {
    const now = Date.parse("2026-11-04T12:00:00.000Z");
    expect(
      isPresenceLive(
        {
          profileId: "a",
          eventId: "e",
          status: "active",
          source: "session",
          updatedAt: new Date(now).toISOString(),
          expiresAt: nextExpiry(now - 120_000),
        },
        now,
      ),
    ).toBe(false);
  });
});

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

  it("demo explanation only cites shared evidence", () => {
    const explanation = demoExplanation({
      otherName: "Ada",
      shared: { goals: [], interests: ["models"], skills: [] },
      complement: [],
      confidence: "low",
      goalLabels: [],
    });
    expect(assertGrounded(explanation, { goals: [], interests: ["models"], skills: [], complement: [] })).toBeNull();
    expect(explanation.source).toBe("demo");
  });
});

describe("analytics", () => {
  it("hides topics under five cases and computes conversion", () => {
    const events = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `a${index}`,
        eventId: "e",
        type: "recommendation_shown" as const,
        at: "2026-11-04T10:00:00.000Z",
        topic: "models",
      })),
      {
        id: "ok",
        eventId: "e",
        type: "connection_accepted" as const,
        at: "2026-11-04T11:00:00.000Z",
        topic: null,
      },
    ];
    const report = aggregateActivity({ events, visible: 3 });
    expect(report.topics).toEqual([]);
    expect(report.suppressedTopics).toBe(1);
    expect(report.conversion).toBe(0.25);
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
