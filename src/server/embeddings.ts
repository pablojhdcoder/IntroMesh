import { canonicalContextText, canonicalGlobalText, sha256 } from "@/domain/identity/canonical";
import { claimEmbedding, finishEmbedding } from "@/domain/embedding/jobs";
import type { Store } from "@/lib/store";

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

/** Procesa la cola de un proceso. Idempotente: un hash vigente no se regenera. */
export async function processEmbeddingQueue(
  store: Store,
  embed: (text: string) => Promise<number[]>,
  now = Date.now(),
): Promise<number> {
  let done = 0;
  for (;;) {
    const claimed = await store.update((database) => {
      const next = claimEmbedding(database.embeddings, now);
      database.embeddings = next.records;
      if (!next.job) return null;
      return { id: next.job.id, hash: next.job.inputHash };
    });
    if (!claimed) return done;
    const loaded = await store.read();
    const source = sourceText(loaded, claimed.id);
    if (!source || source.hash !== claimed.hash) {
      await store.update((database) => {
        const current = database.embeddings.find((item) => item.id === claimed.id);
        if (current && current.inputHash !== claimed.hash) return;
        database.embeddings = finishEmbedding(database.embeddings, claimed.id, null, "stale", Date.now());
        database.metrics.failures += 1;
      });
      continue;
    }
    try {
      const vector = await embed(source.text);
      await store.update((database) => {
        const current = database.embeddings.find((item) => item.id === claimed.id);
        if (!current || current.inputHash !== claimed.hash) return;
        database.embeddings = finishEmbedding(database.embeddings, claimed.id, vector, null, Date.now());
        database.metrics.embeddingsGenerated += 1;
      });
      done += 1;
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
        database.metrics.retries += 1;
      });
    }
  }
}
