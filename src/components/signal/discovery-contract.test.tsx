import { describe, expect, it } from "vitest";
import {
  connectionActionBody,
  explainErrorCopy,
  normalizeDiscovery,
} from "@/components/signal/use-room";

const recommendedRow = {
  id: "ada",
  slug: "ada",
  displayName: "Ada",
  role: "Robotics",
  demo: false,
  x: 62,
  y: 38,
  presence: "active",
  interests: ["drones"],
  skills: ["rust"],
  recommendation: {
    score: 9,
    confidence: "high",
    shared: { goals: ["Find collaborators"], interests: ["drones"], skills: ["rust"] },
    complement: ["fundraising"],
  },
};

const directoryRow = {
  id: "bea",
  slug: "bea",
  displayName: "Bea",
  role: "Design",
  demo: true,
  presence: "active",
  interests: ["typography"],
  skills: ["figma"],
};

describe("normalizeDiscovery (production contract)", () => {
  it("passes recommended people and the directory through with presence and status", () => {
    const snapshot = normalizeDiscovery({
      people: [recommendedRow],
      directory: [directoryRow],
      presence: "visible",
      viewerEmbeddingStatus: "ready",
    });
    expect(snapshot.people).toHaveLength(1);
    expect(snapshot.people[0]?.id).toBe("ada");
    expect(snapshot.people[0]?.recommendation?.score).toBe(9);
    expect(snapshot.directory).toHaveLength(1);
    expect(snapshot.directory[0]).toMatchObject({ id: "bea", presence: "active", demo: true });
    expect(snapshot.presence).toBe("visible");
    expect(snapshot.viewerEmbeddingStatus).toBe("ready");
  });

  it("flags viewerEmbeddingStatus pending so the field shows a skeleton, not fake nodes", () => {
    const snapshot = normalizeDiscovery({
      people: [],
      directory: [directoryRow],
      presence: "visible",
      viewerEmbeddingStatus: "pending",
    });
    expect(snapshot.viewerEmbeddingStatus).toBe("pending");
    expect(snapshot.people).toEqual([]);
  });

  it("splits the legacy shape: null-recommendation rows become directory, never field nodes", () => {
    const legacy = { ...recommendedRow };
    const cold = { ...directoryRow, x: 20, y: 80, recommendation: null };
    const snapshot = normalizeDiscovery({ people: [legacy, cold], presence: "visible" });
    expect(snapshot.people.map((person) => person.id)).toEqual(["ada"]);
    expect(snapshot.directory.map((person) => person.id)).toEqual(["bea"]);
    // Field nodes carry server coordinates; directory rows carry none.
    expect(snapshot.people[0]).toMatchObject({ x: 62, y: 38 });
    expect(snapshot.directory[0]).not.toHaveProperty("x");
    expect(snapshot.directory[0]).not.toHaveProperty("recommendation");
  });

  it("defaults safely when the payload is empty or malformed", () => {
    expect(normalizeDiscovery(null)).toEqual({
      people: [],
      directory: [],
      presence: "hidden",
      viewerEmbeddingStatus: "ready",
    });
    expect(normalizeDiscovery({})).toMatchObject({ people: [], directory: [], viewerEmbeddingStatus: "ready" });
  });

  it("drops malformed recommendations to the directory path, never the field", () => {
    const malformed = [
      { ...recommendedRow, id: "nan-score", recommendation: { ...recommendedRow.recommendation, score: NaN } },
      { ...recommendedRow, id: "inf-score", recommendation: { ...recommendedRow.recommendation, score: Infinity } },
      { ...recommendedRow, id: "no-shared", recommendation: { score: 8, confidence: "high", complement: ["x"] } },
      {
        ...recommendedRow,
        id: "shared-not-arrays",
        recommendation: {
          score: 8,
          confidence: "high",
          shared: { goals: "yes", interests: null, skills: {} },
          complement: ["x"],
        },
      },
      {
        ...recommendedRow,
        id: "complement-not-array",
        recommendation: { ...recommendedRow.recommendation, complement: "fundraising" },
      },
      { ...recommendedRow, id: "string-rec", recommendation: "great match" },
    ];
    const snapshot = normalizeDiscovery({ people: malformed, presence: "visible" });
    expect(snapshot.people).toEqual([]);
    expect(snapshot.directory.map((person) => person.id)).toEqual([
      "nan-score",
      "inf-score",
      "no-shared",
      "shared-not-arrays",
      "complement-not-array",
      "string-rec",
    ]);
    expect(snapshot.directory[0]).not.toHaveProperty("recommendation");
  });

  it("keeps the demo flag on profiles so it renders as a badge only", () => {
    const snapshot = normalizeDiscovery({
      people: [{ ...recommendedRow, demo: true }],
      directory: [directoryRow],
      presence: "visible",
      viewerEmbeddingStatus: "ready",
    });
    expect(snapshot.people[0]?.demo).toBe(true);
    expect(snapshot.directory[0]?.demo).toBe(true);
  });
});

describe("explainErrorCopy", () => {
  it("is honest when Meta cannot explain: no invented text", () => {
    expect(explainErrorCopy("meta")).toBe("Explanation unavailable — Meta API not configured. Try again.");
  });

  it("keeps match and presence copy", () => {
    expect(explainErrorCopy("match")).toBe("Not enough evidence.");
    expect(explainErrorCopy("presence")).toBe("Join the event to see people.");
  });
});

describe("connectionActionBody", () => {
  it("builds a real accept payload with no simulateDemo key", () => {
    const body = connectionActionBody("conn-1", "accept");
    expect(body).toEqual({ connectionId: "conn-1", action: "accept" });
    expect(body).not.toHaveProperty("simulateDemo");
  });

  it("builds a decline payload with no simulateDemo key", () => {
    const body = connectionActionBody("conn-2", "decline");
    expect(body).toEqual({ connectionId: "conn-2", action: "decline" });
    expect(body).not.toHaveProperty("simulateDemo");
  });
});
