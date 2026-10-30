import { describe, expect, it } from "vitest";
import { shouldCallMetaForAffinity } from "./explain";

describe("shouldCallMetaForAffinity", () => {
  it("no llama a Meta si el otro perfil es demostración", () => {
    expect(
      shouldCallMetaForAffinity({ viewerDemo: false, otherDemo: true, modelConfigured: true }),
    ).toBe(false);
  });

  it("no llama a Meta si el visitante es demostración", () => {
    expect(
      shouldCallMetaForAffinity({ viewerDemo: true, otherDemo: false, modelConfigured: true }),
    ).toBe(false);
  });

  it("no llama a Meta sin clave, aunque los dos perfiles sean reales", () => {
    expect(
      shouldCallMetaForAffinity({ viewerDemo: false, otherDemo: false, modelConfigured: false }),
    ).toBe(false);
  });

  it("solo llama a Meta entre perfiles reales con clave", () => {
    expect(
      shouldCallMetaForAffinity({ viewerDemo: false, otherDemo: false, modelConfigured: true }),
    ).toBe(true);
  });
});
