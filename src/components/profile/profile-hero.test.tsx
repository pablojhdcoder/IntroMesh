import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileHero } from "@/components/profile/profile-hero";
import type { ProfileLike } from "@/components/profile/profile-view";

const profile: ProfileLike = {
  displayName: "Ada Lovelace",
  slug: "ada",
  username: "ada",
  role: "Robotics engineer",
  interests: ["drones"],
  skills: ["rust"],
  projects: [],
  goal: "cofounder",
};

describe("ProfileHero", () => {
  it("renders the @handle as the heading, not the display name", () => {
    const html = renderToStaticMarkup(createElement(ProfileHero, { profile }));
    expect(html).toContain("<h1");
    expect(html).toContain("@ada");
    expect(html).toContain('<span class="sr-only">Ada Lovelace </span>');
    expect(html).toContain("Find a cofounder");
  });

  it("renders initials on the signal fallback when there is no avatar", () => {
    const html = renderToStaticMarkup(createElement(ProfileHero, { profile }));
    expect(html).toContain("AL");
    expect(html).toContain("bg-signal");
    expect(html).not.toContain("Profile photo of");
  });

  it("renders stats when provided", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileHero, { profile, stats: { connections: 3, events: 2 } }),
    );
    expect(html).toContain("Connections");
    expect(html).toContain("Events");
    expect(html).toContain(">3<");
    expect(html).toContain(">2<");
  });
});
