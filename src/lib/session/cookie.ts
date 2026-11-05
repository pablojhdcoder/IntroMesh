import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { openProfileId, sealProfileId } from "./token";

const COOKIE = "im_profile";

/** The configured session secret, or null when no env secret is set. */
export function sessionSecretFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.SESSION_SECRET?.trim();
  return value ? value : null;
}

let generatedSecret: string | null = null;

function sessionSecret(): string {
  // Production (Vercel) has no persistent writable filesystem and every
  // instance would mint a different random secret, silently invalidating
  // cookies across instances. The secret must come from the environment.
  const fromEnv = sessionSecretFromEnv();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not set");
  }
  // Dev/test only: keep the previous file-backed secret so local cookies
  // survive restarts; if the filesystem is unavailable, reuse one
  // process-lifetime secret instead of throwing.
  const directory = path.join(process.cwd(), ".data");
  const file = path.join(directory, "session.secret");
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    generatedSecret ??= randomBytes(32).toString("hex");
    try {
      mkdirSync(directory, { recursive: true });
      writeFileSync(file, generatedSecret, { encoding: "utf8", mode: 0o600 });
    } catch {
      // Read-only workspace: the in-memory secret still works for this run.
    }
    return generatedSecret;
  }
}

export async function readProfileId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return openProfileId(token, sessionSecret());
}

export async function writeProfileId(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, sealProfileId(id, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearProfileId(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
