import { embedText } from "@/lib/embedding/engine";
import { getStore } from "@/lib/store";
import { processEmbeddingQueue, recomputeAfterEmbedding } from "@/server/embeddings";

/**
 * Queue drain + write-path recompute. API routes only enqueue jobs via
 * scheduleEmbedding and trigger one inline job via `after()`; this worker
 * is the retry runner for failed/pending jobs (it already drains the
 * shared queue via processEmbeddingQueue, which leaves retryable failures
 * claimable under the 3-attempt lease): `npm run worker:embeddings`.
 * Full rescan: `npm run backfill:embeddings`. Not a required production
 * service.
 */
async function main(): Promise<void> {
  const store = getStore();
  const { count, completed } = await processEmbeddingQueue(store, embedText);
  let viewers = 0;
  for (const job of completed) {
    viewers += await recomputeAfterEmbedding(store, job);
  }
  console.log(`embeddings completed: ${count}, recommendation lists touched: ${viewers}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "embedding worker failed");
  process.exitCode = 1;
});
