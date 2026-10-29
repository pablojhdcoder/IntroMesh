import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { openProfileId, sealProfileId } from "@/lib/session-token";

const COOKIE = "im_profile";

function sessionSecret(): string {
  const directory = path.join(process.cwd(), ".data");
  const file = path.join(directory, "session.secret");
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    mkdirSync(directory, { recursive: true });
    const secret = randomBytes(32).toString("hex");
    writeFileSync(file, secret, { encoding: "utf8", mode: 0o600 });
    return secret;
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
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
