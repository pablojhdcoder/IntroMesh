import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShowCard, ShowCardFace } from "@/components/profile/show-card";
import type { ProfileLike } from "@/components/profile/profile-view";

const profile: ProfileLike = {
  displayName: "Ada Lovelace",
  slug: "ada",
  username: "ada",
  role: "Robotics engineer",
  interests: ["drones", "rust", "sensors", "extra"],
  skills: ["rust"],
  projects: [],
};

describe("ShowCard", () => {
  it("renders the segmented control and the show-my-card prompt", () => {
    const html = renderToStaticMarkup(createElement(ShowCard, { profile }));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Profile");
    expect(html).toContain("Card");
    expect(html).toContain("Show my card");
  });

  it("renders @username and the QR alt text on the card face", () => {
    const html = renderToStaticMarkup(createElement(ShowCardFace, { profile }));
    expect(html).toContain("@ada");
    expect(html).toContain("QR code for Ada Lovelace&#x27;s profile");
    expect(html).toContain("/api/profiles/ada/qr");
    expect(html).toContain("/u/ada");
    expect(html).not.toContain("extra");
  });

  it("hides the QR when the profile is private", () => {
    const html = renderToStaticMarkup(
      createElement(ShowCard, { profile: { ...profile, profileVisibility: "private" } }),
    );
    expect(html).not.toContain("/api/profiles/ada/qr");
    expect(html).not.toContain("QR code for");
    expect(html).toContain("private");
  });
});
