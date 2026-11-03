import { AZURE_EMBEDDING_MODEL_ID, AZURE_EMBEDDING_REVISION } from "@/domain/embedding/azure";

export type EmbeddingStatus = "pending" | "processing" | "completed" | "failed";

export type EmbeddingRecord = {
  id: string;
  kind: "global" | "event";
  userId: string;
  eventId: string | null;
  vector: number[] | null;
  modelId: string;
  modelRevision: string;
  inputHash: string;
  profileRevision: number;
  status: EmbeddingStatus;
  attempts: number;
  leaseUntil: string | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
};

const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 3;

/** Attempts before a failed job stops being claimable. Shared by the queue drain. */
export const MAX_EMBEDDING_ATTEMPTS = MAX_ATTEMPTS;

export function sameEmbedding(record: EmbeddingRecord, inputHash: string, revision: number): boolean {
  return record.status === "completed" && record.inputHash === inputHash && record.profileRevision === revision && record.vector !== null;
}

export function upsertEmbeddingJob(
  records: readonly EmbeddingRecord[],
  draft: Pick<EmbeddingRecord, "kind" | "userId" | "eventId" | "inputHash" | "profileRevision" | "modelId" | "modelRevision">,
  now: number,
): { records: EmbeddingRecord[]; action: "reused" | "scheduled" } {
  const index = records.findIndex(
    (item) => item.kind === draft.kind && item.userId === draft.userId && item.eventId === draft.eventId,
  );
  const current = index >= 0 ? records[index] : null;
  // A provider swap changes canonical hashes AND model identity. Same text
  // under an old model id/revision must re-embed, never be reused.
  const modelStale =
    current != null && (current.modelId !== draft.modelId || current.modelRevision !== draft.modelRevision);
  if (current && !modelStale && sameEmbedding(current, draft.inputHash, draft.profileRevision)) {
    return { records: [...records], action: "reused" };
  }
  const next: EmbeddingRecord = {
    id: current?.id ?? `${draft.kind}:${draft.userId}:${draft.eventId ?? "global"}`,
    kind: draft.kind,
    userId: draft.userId,
    eventId: draft.eventId,
    vector: null,
    modelId: draft.modelId,
    modelRevision: draft.modelRevision,
    inputHash: draft.inputHash,
    profileRevision: draft.profileRevision,
    status: "pending",
    attempts: current && current.inputHash === draft.inputHash && !modelStale ? current.attempts : 0,
    leaseUntil: null,
    createdAt: current?.createdAt ?? new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    error: null,
  };
  const copy = records.filter((_, item) => item !== index);
  return { records: copy.concat(next), action: "scheduled" };
}

export function claimEmbedding(records: readonly EmbeddingRecord[], now: number): { records: EmbeddingRecord[]; job: EmbeddingRecord | null } {
  const job = records.find((item) => {
    if (item.attempts >= MAX_ATTEMPTS && item.status === "failed") return false;
    if (item.status === "pending" || item.status === "failed") return true;
    if (item.status === "processing" && item.leaseUntil && Date.parse(item.leaseUntil) <= now) return true;
    return false;
  });
  if (!job) return { records: [...records], job: null };
  const claimed: EmbeddingRecord = {
    ...job,
    status: "processing",
    attempts: job.attempts + 1,
    leaseUntil: new Date(now + LEASE_MS).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  return {
    records: records.map((item) => (item.id === job.id ? claimed : item)),
    job: claimed,
  };
}

export function claimEmbeddingById(
  records: readonly EmbeddingRecord[],
  jobId: string,
  now: number,
): { records: EmbeddingRecord[]; job: EmbeddingRecord | null } {
  const target = records.find((item) => item.id === jobId);
  if (!target) return { records: [...records], job: null };
  if (target.status === "completed") return { records: [...records], job: null };
  if (target.attempts >= MAX_ATTEMPTS && target.status === "failed") return { records: [...records], job: null };
  if (target.status === "processing" && target.leaseUntil && Date.parse(target.leaseUntil) > now) {
    return { records: [...records], job: null };
  }
  const claimed: EmbeddingRecord = {
    ...target,
    status: "processing",
    attempts: target.attempts + 1,
    leaseUntil: new Date(now + LEASE_MS).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  return {
    records: records.map((item) => (item.id === jobId ? claimed : item)),
    job: claimed,
  };
}

export function isModelCurrent(record: Pick<EmbeddingRecord, "modelId" | "modelRevision">): boolean {
  return record.modelId === AZURE_EMBEDDING_MODEL_ID && record.modelRevision === AZURE_EMBEDDING_REVISION;
}
export function finishEmbedding(
  records: readonly EmbeddingRecord[],
  id: string,
  vector: number[] | null,
  error: string | null,
  now: number,
): EmbeddingRecord[] {
  return records.map((item) => {
    if (item.id !== id) return item;
    if (error || !vector) {
      return { ...item, status: "failed", error: error ?? "empty", leaseUntil: null, updatedAt: new Date(now).toISOString() };
    }
    return {
      ...item,
      status: "completed",
      vector,
      error: null,
      leaseUntil: null,
      updatedAt: new Date(now).toISOString(),
    };
  });
}
