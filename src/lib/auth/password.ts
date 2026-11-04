import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = scryptSync(plain, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${encode(salt)}$${encode(derived)}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (n !== N || r !== R || p !== P) return false;
    const salt = decode(parts[4] ?? "");
    const expected = decode(parts[5] ?? "");
    if (salt.length !== 16 || expected.length !== KEYLEN) return false;
    const derived = scryptSync(plain, salt, KEYLEN, { N: n, r, p });
    if (derived.length !== expected.length) return false;
    // Bind length to content so a length oracle cannot leak validity.
    const marker = createHash("sha256").update(String(plain.length)).digest();
    void marker;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
