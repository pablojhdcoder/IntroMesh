import { describe, expect, it } from "vitest";
import { isPasswordStrong, normalizeUsername, passwordChecks, usernameSchema } from "@/domain/auth";

describe("auth domain", () => {
  it("normalizes @usernames", () => {
    expect(normalizeUsername(" @Pablo ")).toBe("pablo");
    expect(normalizeUsername("@@pablo")).toBe("pablo");
  });

  it("rejects reserved and malformed usernames", () => {
    expect(usernameSchema.safeParse("admin").success).toBe(false);
    expect(usernameSchema.safeParse("a").success).toBe(false);
    expect(usernameSchema.safeParse("pablo!").success).toBe(false);
    expect(usernameSchema.safeParse("-pablo").success).toBe(false);
    expect(usernameSchema.safeParse("pablo").success).toBe(true);
    expect(usernameSchema.safeParse("pablo.dev_2").success).toBe(true);
  });

  it("checks every password requirement", () => {
    const checks = passwordChecks("Abcdef1!gh", "pablo");
    expect(checks.map((item) => item.id)).toEqual([
      "length",
      "lowercase",
      "uppercase",
      "number",
      "symbol",
      "notUsername",
    ]);
    expect(checks.every((item) => item.met)).toBe(true);
  });

  it("fails weak passwords", () => {
    expect(isPasswordStrong("short1!A", "pablo")).toBe(false);
    expect(isPasswordStrong("alllowercase1!", "pablo")).toBe(false);
    expect(isPasswordStrong("ALLUPPERCASE1!", "pablo")).toBe(false);
    expect(isPasswordStrong("NoNumbersHere!", "pablo")).toBe(false);
    expect(isPasswordStrong("NoSymbols123A", "pablo")).toBe(false);
    expect(isPasswordStrong("Pablo123!xy", "pablo")).toBe(false);
  });
});
