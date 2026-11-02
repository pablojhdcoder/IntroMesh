import { describe, expect, it } from "vitest";
import { buildVCard } from "@/lib/wallet/vcard";
import { buildGenericObject, buildSaveUrl, googleWalletStatus } from "@/lib/wallet/google";
import { appleWalletStatus, buildPassJson } from "@/lib/wallet/apple";
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

describe("wallet cards", () => {
  it("builds a vCard with only public fields", () => {
    const vcard = buildVCard(card, "https://example.com");
    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("https://example.com/p/ada-123");
    expect(vcard).not.toContain("user-1");
  });

  it("builds a Google Generic object whose barcode is the profile URL", () => {
    const object = buildGenericObject(card, "https://example.com", "issuer-1");
    expect(object.barcode.value).toBe("https://example.com/p/ada-123");
    expect(object.id).toContain("issuer-1");
  });

  it("reports Google Wallet unconfigured without env", () => {
    const status = googleWalletStatus();
    expect(status.configured).toBe(false);
    expect(() => buildSaveUrl(card, "https://example.com")).toThrow();
  });

  it("reports Apple Wallet unconfigured without env and builds a static pass", () => {
    expect(appleWalletStatus().configured).toBe(false);
    const pass = buildPassJson(card, "https://example.com");
    expect(pass.barcodes[0].message).toBe("https://example.com/p/ada-123");
    expect(pass.serialNumber).toContain("ada-123");
  });
});
