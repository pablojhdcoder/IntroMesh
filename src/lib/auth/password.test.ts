import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("Abcdef1!gh");
    expect(await verifyPassword("Abcdef1!gh", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("salts hashes and never contains the plain text", async () => {
    const plain = "Abcdef1!gh";
    const first = await hashPassword(plain);
    const second = await hashPassword(plain);
    expect(first).not.toBe(second);
    expect(first).not.toContain(plain);
    expect(second).not.toContain(plain);
  });

  it("returns false for malformed stored values", async () => {
    expect(await verifyPassword("Abcdef1!gh", "not-a-hash")).toBe(false);
    expect(await verifyPassword("Abcdef1!gh", "")).toBe(false);
  });
});
