import { describe, expect, it } from "vitest";
import { buildVCard } from "@/lib/vcard";
import type { SharedCard } from "@/domain/profile";

const card: SharedCard = {
  id: "user-1",
  slug: "ada-123",
  displayName: "Ada",
  role: "Designer",
  interests: ["models", "hardware"],
  skills: ["frontend"],
  projects: [],
  goal: "hackathon",
  demo: false,
  presentation: null,
};

describe("vcard", () => {
  it("builds a vCard with only public fields", () => {
    const vcard = buildVCard(card, "https://example.com");
    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("https://example.com/p/ada-123");
    expect(vcard).not.toContain("user-1");
  });
});
