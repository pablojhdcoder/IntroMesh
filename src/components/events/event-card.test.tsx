import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventCard, type EventCardEvent } from "@/components/events/event-card";

describe("EventCard", () => {
  it("never renders an event banner, even when the payload still carries a cover", () => {
    // The API/DB may keep storing coverUrl; the front must not show it.
    const event = {
      id: "e1",
      name: "Meta Hackathon",
      status: "live",
      coverUrl: "https://example.com/cover.svg",
    } as EventCardEvent;
    const html = renderToStaticMarkup(createElement(EventCard, { event }));
    expect(html).toContain("Meta Hackathon");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("cover");
  });
});
