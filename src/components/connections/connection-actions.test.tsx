import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConnectionActions } from "@/components/connections/connection-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

describe("ConnectionActions", () => {
  it("renders Accept and Decline for the recipient", () => {
    const html = renderToStaticMarkup(
      createElement(ConnectionActions, { connectionId: "c1", otherName: "Ada Lovelace" }),
    );
    expect(html).toContain("Accept");
    expect(html).toContain("Decline");
    expect(html).toContain('aria-label="Accept request from Ada Lovelace"');
    expect(html).toContain('aria-label="Decline request from Ada Lovelace"');
  });
});
