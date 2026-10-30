import { describe, expect, it } from "vitest";
import { shouldCallMetaForAffinity } from "./explain";

describe("shouldCallMetaForAffinity", () => {
  it("does not call Meta when the other profile is demo", () => {
    expect(
      shouldCallMetaForAffinity({ viewerDemo: false, otherDemo: true, modelConfigured: true }),
    ).toBe(false);
  });

  it("does not call Meta when the viewer is demo", () => {
    expect(
      shouldCallMetaForAffinity({ viewerDemo: true, otherDemo: false, modelConfigured: true }),
    ).toBe(false);
  });

  it("does not call Meta without a key even for real profiles", () => {
    expect(
      shouldCallMetaForAffinity({ viewerDemo: false, otherDemo: false, modelConfigured: false }),
    ).toBe(false);
  });

  it("only calls Meta between real profiles with a key", () => {
    expect(
      shouldCallMetaForAffinity({ viewerDemo: false, otherDemo: false, modelConfigured: true }),
    ).toBe(true);
  });
});
