import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventPicker, type EventCardEvent } from "@/components/events/event-picker";

function makeEvents(count: number): EventCardEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `e${index + 1}`,
    name: `Event ${index + 1}`,
    status: "live",
  }));
}

const baseProps = {
  onPick: () => {},
  canCreateEvent: false,
};

describe("EventPicker pagination", () => {
  it("shows five events per page with page controls", () => {
    const html = renderToStaticMarkup(createElement(EventPicker, { ...baseProps, events: makeEvents(7) }));
    expect(html).toContain("Event 1");
    expect(html).toContain("Event 5");
    expect(html).not.toContain("Event 6");
    expect(html).toContain("Page 1 of 2");
    expect(html).toContain('aria-label="Discover pages"');
  });

  it("shows all events without controls when there are five or fewer", () => {
    const html = renderToStaticMarkup(createElement(EventPicker, { ...baseProps, events: makeEvents(3) }));
    expect(html).toContain("Event 3");
    expect(html).not.toContain("Discover pages");
  });

  it("hides excluded events from the page", () => {
    const html = renderToStaticMarkup(
      createElement(EventPicker, { ...baseProps, events: makeEvents(6), excludedIds: ["e1"] }),
    );
    expect(html).not.toContain("Event 1");
    expect(html).toContain("Event 6");
    expect(html).not.toContain("Discover pages");
  });

  it("sorts events by date, soonest first and undated last", () => {
    const html = renderToStaticMarkup(
      createElement(EventPicker, {
        ...baseProps,
        events: [
          { id: "late", name: "Late event", status: "live", startsAt: "2026-12-01T10:00:00.000Z" },
          { id: "nodate", name: "Dateless event", status: "live", startsAt: null },
          { id: "soon", name: "Soon event", status: "live", startsAt: "2026-01-01T10:00:00.000Z" },
        ],
      }),
    );
    const soon = html.indexOf("Soon event");
    const late = html.indexOf("Late event");
    const dateless = html.indexOf("Dateless event");
    expect(soon).toBeGreaterThan(-1);
    expect(late).toBeGreaterThan(soon);
    expect(dateless).toBeGreaterThan(late);
  });
});
