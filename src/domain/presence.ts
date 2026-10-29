export const PRESENCE_TTL_MS = 90_000;

export type PresenceStatus = "active" | "seeking";

export type PresenceRecord = {
  profileId: string;
  eventId: string;
  status: PresenceStatus;
  source: "session" | "demo";
  updatedAt: string;
  expiresAt: string;
};

export function isPresenceLive(record: PresenceRecord, now: number): boolean {
  return Date.parse(record.expiresAt) > now;
}

export function nextExpiry(now: number, ttlMs = PRESENCE_TTL_MS): string {
  return new Date(now + ttlMs).toISOString();
}
