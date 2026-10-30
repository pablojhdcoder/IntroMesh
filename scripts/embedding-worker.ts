import { embedText } from "../src/lib/embedding/engine";
import { getStore } from "../src/lib/store";
import { processEmbeddingQueue } from "../src/server/embeddings";

processEmbeddingQueue(getStore(), embedText)
  .then((count) => {
    console.log(`embeddings completed: ${count}`);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "embedding worker failed");
    process.exitCode = 1;
  });
