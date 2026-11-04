const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function checkRateLimit(key: string, now = Date.now()): boolean {
  const current = attempts.get(key);
  if (!current || now >= current.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

export function clearRateLimits(): void {
  attempts.clear();
}
