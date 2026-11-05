import { describe, expect, it } from "vitest";
import { sessionSecretFromEnv } from "./cookie";

describe("sessionSecretFromEnv", () => {
  it("prefers the SESSION_SECRET environment variable", () => {
    expect(sessionSecretFromEnv({ SESSION_SECRET: "  test-secret  " })).toBe("test-secret");
  });

  it("returns null when the variable is missing or blank", () => {
    expect(sessionSecretFromEnv({})).toBeNull();
    expect(sessionSecretFromEnv({ SESSION_SECRET: "   " })).toBeNull();
  });
});
