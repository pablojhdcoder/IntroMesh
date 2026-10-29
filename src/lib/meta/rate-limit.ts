export function takeRateLimitSlot(
  timestamps: readonly number[],
  now: number,
  limit: number,
  windowMs = 60_000,
): { allowed: boolean; timestamps: number[] } {
  const fresh = timestamps.filter((timestamp) => timestamp > now - windowMs);
  if (fresh.length >= limit) return { allowed: false, timestamps: fresh };
  return { allowed: true, timestamps: [...fresh, now] };
}

const slots: number[] = [];

export function resetMetaRateLimit(): void {
  slots.length = 0;
}

export function assertMetaRateLimit(now: number, limit: number): void {
  const next = takeRateLimitSlot(slots, now, limit);
  slots.length = 0;
  slots.push(...next.timestamps);
  if (!next.allowed) {
    throw new Error("RATE_LIMIT");
  }
}
