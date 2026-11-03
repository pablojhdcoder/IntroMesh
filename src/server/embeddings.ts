import { canonicalContextText, canonicalGlobalText, sha256 } from "@/domain/identity/canonical";
import {
  MAX_EMBEDDING_ATTEMPTS,
  claimEmbeddingById,
  finishEmbedding,
  isModelCurrent,
} from "@/domain/embedding/jobs";
import type { Database, Store } from "@/lib/store";
import { isRetryableEmbeddingError } from "@/lib/embedding/engine";
import { insertCandidateAgainstViewers, recomputeViewerOnEmbedding } from "@/server/recompute";

function sourceText(database: Awaited<ReturnType<Store["read"]>>, jobId: string): { id: string; text: string; hash: string } | null {
  const job = database.embeddings.find((item) => item.id === jobId);
  if (!job) return null;
  if (job.kind === "global") {
    const identity = database.identities.find((item) => item.userId === job.userId && item.status === "confirmed");
    if (!identity?.confirmed) return null;
    const text = canonicalGlobalText(identity.confirmed);
    return sha256(text) === job.inputHash ? { id: job.id, text, hash: job.inputHash } : null;
  }
  const participation = database.participations.find(
    (item) => item.userId === job.userId && item.eventId === job.eventId && item.status === "joined",
  );
  const identity = database.identities.find((item) => item.userId === job.userId);
  const event = database.events.find((item) => item.id === job.eventId);
  if (!participation || !event) return null;
  const text = canonicalContextText({
    intent: participation.intentText,
    lookingFor: identity?.confirmed?.looking_for ?? participation.lookingFor,
    collaboration: participation.collaborationInterests,
    eventName: event.name,
    eventCategory: event.category,
    eventDescription: event.description,
  });
  return sha256(text) === job.inputHash ? { id: job.id, text, hash: job.inputHash } : null;
}

export type CompletedEmbeddingJob = {
  id: string;
  kind: "global" | "event";
  userId: string;
  eventId: string | null;
};

type ClaimedJob = CompletedEmbeddingJob & {
  hash: string;
  modelId: string;
  modelRevision: string;
};

function staleReasonFor(
  database: Database,
  job: { id: string; modelId: string; modelRevision: string },
): string | null {
  // Model check first (no source read needed); then hash freshness against
  // the current canonical text. Either stale flavor must not burn an attempt:
  // callers mark it failed directly without claiming.
  if (!isModelCurrent(job)) return `stale model ${job.modelId}/${job.modelRevision}`;
  if (!sourceText(database, job.id)) return "stale";
  return null;
}

function markStale(database: Database, claimed: ClaimedJob, reason: string): void {
  const current = database.embeddings.find((item) => item.id === claimed.id);
  if (current && current.inputHash !== claimed.hash) return;
  database.embeddings = finishEmbedding(database.embeddings, claimed.id, null, reason, Date.now());
  database.metrics.failures += 1;
}

/**
 * Shared single-claim execution: verify source hash, reject stale-provider
 * rows (never embed old-model text with the new engine), embed, finish.
 * Used by both the queue drain and the inline single-job path.
 */
async function runClaimedJob(
  store: Store,
  claimed: ClaimedJob,
  embed: (text: string) => Promise<number[]>,
): Promise<CompletedEmbeddingJob | null> {
  const loaded = await store.read();
  const source = sourceText(loaded, claimed.id);
  if (!source || source.hash !== claimed.hash) {
    await store.update((database) => {
      markStale(database, claimed, "stale");
    });
    return null;
  }
  if (!isModelCurrent(claimed)) {
    await store.update((database) => {
      markStale(database, claimed, `stale model ${claimed.modelId}/${claimed.modelRevision}`);
    });
    return null;
  }
  try {
    const vector = await embed(source.text);
    await store.update((database) => {
      const current = database.embeddings.find((item) => item.id === claimed.id);
      if (!current || current.inputHash !== claimed.hash) return;
      database.embeddings = finishEmbedding(database.embeddings, claimed.id, vector, null, Date.now());
      database.metrics.embeddingsGenerated += 1;
    });
    return { id: claimed.id, kind: claimed.kind, userId: claimed.userId, eventId: claimed.eventId };
  } catch (error) {
    await store.update((database) => {
      database.embeddings = finishEmbedding(
        database.embeddings,
        claimed.id,
        null,
        error instanceof Error ? error.message : "embedding failed",
        Date.now(),
      );
      database.metrics.failures += 1;
      // Only transport/retryable failures count as retries; stale, schema,
      // and validation failures are terminal for this job version and must
      // not inflate the retry signal.
      if (isRetryableEmbeddingError(error)) database.metrics.retries += 1;
    });
    return null;
  }
}

/**
 * Write-path recompute for one finished job: the viewer's own lists plus
 * every other live viewer in the same event (candidate direction).
 * Shared by the worker script and the inline API path.
 */
export async function recomputeAfterEmbedding(store: Store, job: CompletedEmbeddingJob): Promise<number> {
  if (job.kind === "global") {
    return store.update((database) => {
      const eventIds = database.participations
        .filter((item) => item.userId === job.userId && item.status === "joined")
        .map((item) => item.eventId);
      const now = Date.now();
      let touched = 0;
      for (const eventId of [...new Set(eventIds)]) {
        if (recomputeViewerOnEmbedding(database, job.userId, eventId, now)) touched += 1;
        touched += insertCandidateAgainstViewers(database, job.userId, eventId, now);
      }
      return touched;
    });
  }
  if (!job.eventId) return 0;
  const eventId = job.eventId;
  return store.update((database) => {
    const now = Date.now();
    let count = recomputeViewerOnEmbedding(database, job.userId, eventId, now) ? 1 : 0;
    count += insertCandidateAgainstViewers(database, job.userId, eventId, now);
    return count;
  });
}

/** Procesa la cola de un proceso. Idempotente: un hash vigente no se regenera. */
export async function processEmbeddingQueue(
  store: Store,
  embed: (text: string) => Promise<number[]>,
  now = Date.now(),
): Promise<{ count: number; completed: CompletedEmbeddingJob[] }> {
  let done = 0;
  const completed: CompletedEmbeddingJob[] = [];
  // Rows marked stale-without-burn stay failed with attempts < max, hence
  // still "claimable" by the lease predicate. Track them so one drain does
  // not revisit the same stale row forever; a later scheduleEmbedding (new
  // model/hash) creates the retryable row. The 3-attempt lease semantics in
  // claimEmbedding are unchanged.
  const settledStale = new Set<string>();
  for (;;) {
    const claimed = await store.update((database) => {
      const candidate = database.embeddings.find((item) => {
        if (settledStale.has(item.id)) return false;
        if (item.attempts >= MAX_EMBEDDING_ATTEMPTS && item.status === "failed") return false;
        if (item.status === "pending" || item.status === "failed") return true;
        if (item.status === "processing" && item.leaseUntil && Date.parse(item.leaseUntil) <= now) return true;
        return false;
      });
      if (!candidate) return null;
      // L2: stale-model / stale-hash rows never consume an attempt. Mark
      // them failed directly (observable via error + metrics.failures) so
      // the worker/backfill stays the retry runner for rescheduled rows.
      const reason = staleReasonFor(database, candidate);
      if (reason) {
        database.embeddings = finishEmbedding(database.embeddings, candidate.id, null, reason, Date.now());
        database.metrics.failures += 1;
        settledStale.add(candidate.id);
        return { stale: true as const };
      }
      const next = claimEmbeddingById(database.embeddings, candidate.id, now);
      database.embeddings = next.records;
      if (!next.job) {
        settledStale.add(candidate.id);
        return { stale: true as const };
      }
      const job = next.job;
      return {
        id: job.id,
        hash: job.inputHash,
        kind: job.kind,
        userId: job.userId,
        eventId: job.eventId,
        modelId: job.modelId,
        modelRevision: job.modelRevision,
      } satisfies ClaimedJob;
    });
    if (!claimed) return { count: done, completed };
    if ("stale" in claimed) continue;
    const finished = await runClaimedJob(store, claimed, embed);
    if (!finished) continue;
    completed.push(finished);
    done += 1;
  }
}

/**
 * Inline path (Vercel `after()`): claim ONE job by id, embed, and recompute
 * the affected recommendation lists. Returns the finished job, or null when
 * there was nothing claimable (done, leased, stale, or failed). Never throws
 * for transport/model errors — the worker/backfill retries them.
 */
export async function processEmbeddingJob(
  store: Store,
  jobId: string,
  embed: (text: string) => Promise<number[]>,
  now = Date.now(),
): Promise<CompletedEmbeddingJob | null> {
  const claimed = await store.update((database) => {
    const target = database.embeddings.find((item) => item.id === jobId);
    if (!target || target.status === "completed") return null;
    // L2: check model + hash freshness BEFORE claiming so stale rows never
    // burn one of their 3 attempts. Stale rows fail observably; rescheduling
    // via scheduleEmbedding (worker/backfill) is the retry path.
    const reason = staleReasonFor(database, target);
    if (reason) {
      database.embeddings = finishEmbedding(database.embeddings, target.id, null, reason, Date.now());
      database.metrics.failures += 1;
      return { stale: true as const };
    }
    const next = claimEmbeddingById(database.embeddings, jobId, now);
    database.embeddings = next.records;
    if (!next.job) return null;
    const job = next.job;
    return {
      id: job.id,
      hash: job.inputHash,
      kind: job.kind,
      userId: job.userId,
      eventId: job.eventId,
      modelId: job.modelId,
      modelRevision: job.modelRevision,
    } satisfies ClaimedJob;
  });
  if (!claimed || "stale" in claimed) return null;
  const finished = await runClaimedJob(store, claimed, embed);
  if (!finished) return null;
  await recomputeAfterEmbedding(store, finished);
  return finished;
}
