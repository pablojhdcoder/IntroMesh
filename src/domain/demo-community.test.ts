import { describe, expect, it } from "vitest";
import { DEMO_PER_EXTRA_EVENT, extraEventParticipations } from "@/domain/demo-community";
import { EXTRA_EVENTS } from "@/lib/store/types";

const NOW = Date.parse("2026-11-04T09:00:00.000Z");

describe("extraEventParticipations", () => {
  it("puts 8 joined demo members in every extra event", () => {
    const rows = extraEventParticipations(
      EXTRA_EVENTS.map((event) => event.id),
      DEMO_PER_EXTRA_EVENT,
      NOW,
    );
    expect(rows).toHaveLength(EXTRA_EVENTS.length * DEMO_PER_EXTRA_EVENT);
    for (const event of EXTRA_EVENTS) {
      const members = rows.filter((row) => row.eventId === event.id);
      expect(members).toHaveLength(DEMO_PER_EXTRA_EVENT);
      expect(new Set(members.map((row) => row.userId)).size).toBe(DEMO_PER_EXTRA_EVENT);
      expect(members.every((row) => row.status === "joined" && row.consent)).toBe(true);
    }
  });

  it("is deterministic across runs", () => {
    const first = extraEventParticipations(["e1", "e2"], 8, NOW);
    const second = extraEventParticipations(["e1", "e2"], 8, NOW);
    expect(first).toEqual(second);
  });
});
