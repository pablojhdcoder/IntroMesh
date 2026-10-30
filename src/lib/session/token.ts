import { createHmac, timingSafeEqual } from "node:crypto";

export function sealProfileId(id: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(id).digest("base64url");
  return `${id}.${mac}`;
}

export function openProfileId(token: string, secret: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(id).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return id;
}
