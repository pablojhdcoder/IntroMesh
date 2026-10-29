import { describe, expect, it } from "vitest";
import { openProfileId, sealProfileId } from "@/lib/session-token";
import { toSharedCard, type StoredProfile } from "./profile";
import { aggregateActivity } from "./analytics";
import { assertGrounded, demoExplanation, type GroundedExplanation } from "./ground";
import { isPresenceLive, nextExpiry } from "./presence";
import { selectCandidates } from "./matching/select-candidates";

describe("presence", () => {
  it("caduca un heartbeat abandonado", () => {
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
  it("rechaza un interés que no está en la evidencia", () => {
    const explanation: GroundedExplanation = {
      source: "model",
      summary: "Compartís modelos y también hardware.",
      opener: "¿Hablamos de modelos?",
      citedGoals: [],
      citedInterests: ["modelos"],
      citedSkills: [],
      complement: [],
      confidence: "medium",
    };
    expect(assertGrounded(explanation, { goals: [], interests: ["modelos"], skills: [], complement: [] })).toBe(
      "unsupported-term",
    );
  });

  it("la explicación de demostración solo cita lo compartido", () => {
    const explanation = demoExplanation({
      otherName: "Ada",
      shared: { goals: [], interests: ["modelos"], skills: [] },
      complement: [],
      confidence: "low",
      goalLabels: [],
    });
    expect(assertGrounded(explanation, { goals: [], interests: ["modelos"], skills: [], complement: [] })).toBeNull();
    expect(explanation.source).toBe("demo");
  });
});

describe("analytics", () => {
  it("oculta temas con menos de cinco casos y calcula la conversión", () => {
    const events = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `a${index}`,
        eventId: "e",
        type: "recommendation_shown" as const,
        at: "2026-11-04T10:00:00.000Z",
        topic: "modelos",
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
  it("puntúa una habilidad que el otro tiene y tú estás buscando", () => {
    const [match] = selectCandidates(
      {
        id: "me",
        displayName: "Yo",
        discoverable: true,
        goals: ["hackathon"],
        interests: [],
        skills: [],
        seeking: "busco frontend para el prototipo",
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

describe("sesión y ficha compartida", () => {
  it("no acepta un id de perfil sin firma", () => {
    const token = sealProfileId("user-1", "secret");
    expect(openProfileId(token, "secret")).toBe("user-1");
    expect(openProfileId("user-1", "secret")).toBeNull();
    expect(openProfileId(token, "otro")).toBeNull();
  });

  it("la ficha compartida omite lo que se busca y lo que se ofrece", () => {
    const profile: StoredProfile = {
      id: "user-1",
      slug: "ada",
      displayName: "Ada",
      role: "Diseño",
      bio: "privado",
      interests: ["diseño"],
      skills: ["frontend"],
      projects: [],
      links: [{ label: "Web", url: "https://example.com" }],
      offers: "mentoría",
      seeking: "un cofundador",
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
