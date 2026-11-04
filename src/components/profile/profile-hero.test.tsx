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
  presentation: {
    headline: "Ada · Robotics",
    summary: "Builds flying machines.",
    opener: "What flies here?",
  },
  offers: "Can help with rust.",
  seeking: "Looking for pilots.",
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

  it("renders the detailed variant with about, interests and a pinned stats bar", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileHero, { profile, stats: { connections: 3 }, variant: "detailed" }),
    );
    expect(html).toContain("Ada · Robotics");
    expect(html).toContain("Builds flying machines.");
    expect(html).toContain("Interests");
    expect(html).toContain("Skills");
    expect(html).toContain("Offers");
    expect(html).toContain("Seeking");
    expect(html).toContain("Connections");
    expect(html).toContain("border-t");
  });

  it("renders the summary variant without the details sections", () => {
    const html = renderToStaticMarkup(createElement(ProfileHero, { profile, stats: { connections: 3 } }));
    expect(html).toContain("@ada");
    expect(html).toContain("Connections");
    expect(html).not.toContain("Interests");
  });
});
