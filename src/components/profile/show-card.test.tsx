import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShowCardFace } from "@/components/profile/show-card";
import { ProfileManager } from "@/components/profile/profile-manager";
import type { ProfileLike } from "@/components/profile/profile-view";

const profile: ProfileLike & { goal: string } = {
  displayName: "Ada Lovelace",
  slug: "ada",
  username: "ada",
  role: "Robotics engineer",
  interests: ["drones", "rust", "sensors", "extra"],
  skills: ["rust"],
  projects: [],
  goal: "cofounder",
};

describe("ShowCardFace", () => {
  it("renders the @handle as the card title with the QR", () => {
    const html = renderToStaticMarkup(createElement(ShowCardFace, { profile }));
    expect(html).toContain("@ada");
    expect(html).toContain("QR code for Ada Lovelace&#x27;s profile");
    expect(html).toContain("/api/profiles/ada/qr");
    expect(html).toContain("/u/ada");
    expect(html).not.toContain("extra");
  });
});

describe("ProfileManager", () => {
  it("renders Show my card and Edit profile actions without a segmented control", () => {
    const html = renderToStaticMarkup(createElement(ProfileManager, { profile, connectionsCount: 2 }));
    expect(html).toContain("Show my card");
    expect(html).toContain("Edit profile");
    expect(html).not.toContain('aria-label="Profile view"');
    // Details are visible by default; the editor is not rendered until requested.
    expect(html).not.toContain('aria-label="Edit profile"');
  });

  it("does not render events on the profile", () => {
    const html = renderToStaticMarkup(createElement(ProfileManager, { profile, connectionsCount: 0 }));
    expect(html).not.toContain("Your events");
  });

  it("hides the QR when the profile is private", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileManager, {
        profile: { ...profile, profileVisibility: "private" as const },
        connectionsCount: 0,
      }),
    );
    expect(html).not.toContain("/api/profiles/ada/qr");
    expect(html).not.toContain("QR code for");
    expect(html).toContain("private");
  });
});
