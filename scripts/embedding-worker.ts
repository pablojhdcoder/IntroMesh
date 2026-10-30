import path from "node:path";
import { createFileStore } from "../src/lib/store/file-store";
import { embedText } from "../src/lib/embedding/engine";
import { processEmbeddingQueue } from "../src/server/embeddings";

const store = createFileStore(path.join(process.cwd(), ".data"));

processEmbeddingQueue(store, embedText)
  .then((count) => {
    console.log(`embeddings completed: ${count}`);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "embedding worker failed");
    process.exitCode = 1;
  });
