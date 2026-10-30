export type ExplanationStatus = "pending" | "processing" | "completed" | "failed";

export type CachedExplanation<T> = {
  id: string;
  cacheKey: string;
  eventId: string;
  viewerId: string;
  candidateId: string;
  modelId: string;
  promptVersion: string;
  status: ExplanationStatus;
  value: T | null;
  inputFingerprint: string;
  tokenUsage: { input: number | null; output: number | null } | null;
  attempts: number;
  leaseUntil: string | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
};

const LEASE_MS = 30_000;
const MAX_ATTEMPTS = 3;

export function claimExplanation<T>(
  records: readonly CachedExplanation<T>[],
  draft: Omit<CachedExplanation<T>, "status" | "value" | "attempts" | "leaseUntil" | "updatedAt" | "error" | "tokenUsage">,
  now: number,
  regenerate = false,
): { records: CachedExplanation<T>[]; outcome: "hit" | "wait" | "claimed" | "exhausted"; record: CachedExplanation<T> } {
  const current = records.find((item) => item.cacheKey === draft.cacheKey) ?? null;
  if (current && current.status === "completed" && current.value && !regenerate) {
    return { records: [...records], outcome: "hit", record: current };
  }
  if (
    current &&
    current.status === "processing" &&
    current.leaseUntil &&
    Date.parse(current.leaseUntil) > now &&
    !regenerate
  ) {
    return { records: [...records], outcome: "wait", record: current };
  }
  const attempts = current?.attempts ?? 0;
  if (attempts >= MAX_ATTEMPTS && current?.status === "failed" && !regenerate) {
    return { records: [...records], outcome: "exhausted", record: current };
  }
  const next: CachedExplanation<T> = {
    ...draft,
    status: "processing",
    value: null,
    tokenUsage: null,
    attempts: attempts + 1,
    leaseUntil: new Date(now + LEASE_MS).toISOString(),
    updatedAt: new Date(now).toISOString(),
    error: null,
    createdAt: current?.createdAt ?? draft.createdAt,
  };
  return {
    records: records.filter((item) => item.cacheKey !== draft.cacheKey).concat(next),
    outcome: "claimed",
    record: next,
  };
}

export function completeExplanation<T>(
  records: readonly CachedExplanation<T>[],
  cacheKey: string,
  value: T,
  usage: { input: number | null; output: number | null } | null,
  now: number,
): CachedExplanation<T>[] {
  return records.map((item) =>
    item.cacheKey === cacheKey
      ? {
          ...item,
          status: "completed",
          value,
          tokenUsage: usage,
          leaseUntil: null,
          error: null,
          updatedAt: new Date(now).toISOString(),
        }
      : item,
  );
}

export function failExplanation<T>(
  records: readonly CachedExplanation<T>[],
  cacheKey: string,
  error: string,
  now: number,
): CachedExplanation<T>[] {
  return records.map((item) =>
    item.cacheKey === cacheKey
      ? { ...item, status: "failed", error, leaseUntil: null, updatedAt: new Date(now).toISOString() }
      : item,
  );
}

export async function resolveExplanation<T>(input: {
  records: CachedExplanation<T>[];
  draft: Omit<CachedExplanation<T>, "status" | "value" | "attempts" | "leaseUntil" | "updatedAt" | "error" | "tokenUsage">;
  now: number;
  regenerate?: boolean;
  callModel: () => Promise<{ value: T; usage: { input: number | null; output: number | null } | null }>;
  wait?: (ms: number) => Promise<void>;
}): Promise<{ records: CachedExplanation<T>[]; value: T; cached: boolean; calls: number }> {
  let records = input.records;
  let calls = 0;
  const wait = input.wait ?? (async () => undefined);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const claimed = claimExplanation(records, input.draft, input.now + attempt, input.regenerate && attempt === 0);
    records = claimed.records;
    if (claimed.outcome === "hit" && claimed.record.value) {
      return { records, value: claimed.record.value, cached: true, calls };
    }
    if (claimed.outcome === "wait") {
      await wait(1);
      continue;
    }
    if (claimed.outcome === "exhausted") {
      throw new Error("explanation attempts exhausted");
    }
    calls += 1;
    try {
      const generated = await input.callModel();
      records = completeExplanation(records, input.draft.cacheKey, generated.value, generated.usage, input.now);
      return { records, value: generated.value, cached: false, calls };
    } catch (error) {
      records = failExplanation(records, input.draft.cacheKey, error instanceof Error ? error.message : "failed", input.now);
      throw error;
    }
  }
  throw new Error("explanation lease waited out");
}
