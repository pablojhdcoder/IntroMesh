import { canonicalContextText, canonicalGlobalText } from "@/domain/identity/canonical";
import { embedText } from "@/lib/embedding/engine";
import { getStore } from "@/lib/store";
import { processEmbeddingQueue, recomputeAfterEmbedding } from "@/server/embeddings";
import { scheduleEmbedding } from "@/server/recommendations";

/**
 * Backfill runner (laptop): re-enqueue every confirmed identity (global job)
 * plus every joined participation (event job) via scheduleEmbedding — the
 * single entry point — then drain the queue with the shared runner.
 *
 * Run: `npm run backfill:embeddings` (requires the AZURE_* env vars).
 * Old-provider rows are detected stale by model id/revision mismatch and
 * re-embedded; unchanged hashes are reused without a new model call.
 *
 * Demo seeds (supabase/migrations/0002_demo_seed.sql) are EXPLICITLY
 * excluded: they are bare profiles + presence with no confirmed identity
 * or joined participation, so no canonical source text exists to embed.
 * They still surface in discovery's directory via live presence; ranked
 * recommendations only ever cover joined participations — the same
 * deterministic rule for every profile, real or demo. Nothing here is
 * silent: excluded profiles simply have no embedding job row.
 */
async function main(): Promise<void> {
  const store = getStore();
  const scanned = await store.update((database) => {
    const now = Date.now();
    let identities = 0;
    let participations = 0;
    for (const identity of database.identities) {
      if (identity.status !== "confirmed" || !identity.confirmed) continue;
      scheduleEmbedding(
        database,
        {
          kind: "global",
          userId: identity.userId,
          eventId: null,
          text: canonicalGlobalText(identity.confirmed),
          revision: identity.revision,
        },
        now,
      );
      identities += 1;
    }
    for (const participation of database.participations) {
      if (participation.status !== "joined") continue;
      const identity = database.identities.find((item) => item.userId === participation.userId);
      const event = database.events.find((item) => item.id === participation.eventId);
      if (!event) continue;
      scheduleEmbedding(
        database,
        {
          kind: "event",
          userId: participation.userId,
          eventId: participation.eventId,
          text: canonicalContextText({
            intent: participation.intentText,
            lookingFor: identity?.confirmed?.looking_for ?? participation.lookingFor,
            collaboration: participation.collaborationInterests,
            eventName: event.name,
            eventCategory: event.category,
            eventDescription: event.description,
          }),
          revision: participation.revision,
        },
        now,
      );
      participations += 1;
    }
    return { identities, participations };
  });
  const { count, completed } = await processEmbeddingQueue(store, embedText);
  let viewers = 0;
  for (const job of completed) {
    viewers += await recomputeAfterEmbedding(store, job);
  }
  console.log(
    `backfill scanned identities=${scanned.identities} participations=${scanned.participations}, embeddings completed: ${count}, recommendation lists touched: ${viewers}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "backfill failed");
  process.exitCode = 1;
});
