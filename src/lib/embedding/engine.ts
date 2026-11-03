import { z } from "zod";
import {
  AZURE_EMBEDDING_MODEL_ID,
  EMBEDDING_DIM,
  assertUnitVector,
  normalizeEmbedding,
} from "@/domain/embedding/azure";
import { MetaConfigError } from "@/lib/meta/errors";

/**
 * Azure OpenAI embeddings. Server-only by construction: imported exclusively
 * from route handlers, server use cases, and scripts — never from client
 * components. The key never leaves the server.
 * NATIVE 1536 dims — the `dimensions` param is deliberately omitted.
 */
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 250;
const BACKOFF_CAP_MS = 2_000;

const azureEmbeddingResponse = z.object({
  data: z.array(z.object({ embedding: z.array(z.number().finite()).min(1) })).min(1),
});

type EmbeddingConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
};

type Env = Record<string, string | undefined>;

function readConfig(env: Env): EmbeddingConfig {
  const endpoint = env.AZURE_OPENAI_ENDPOINT?.trim().replace(/\/+$/, "");
  const apiKey = env.AZURE_OPENAI_API_KEY?.trim();
  if (!endpoint) throw new MetaConfigError("AZURE_OPENAI_ENDPOINT is not set");
  if (!apiKey) throw new MetaConfigError("AZURE_OPENAI_API_KEY is not set");
  return {
    endpoint,
    apiKey,
    deployment: env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT?.trim() || AZURE_EMBEDDING_MODEL_ID,
    apiVersion: env.AZURE_OPENAI_API_VERSION?.trim() || "2024-10-21",
  };
}

function retryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function isRetryableEmbeddingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /status (429|5\d\d)\b/.test(message);
}

function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const grown = BACKOFF_BASE_MS * 2 ** attempt;
  const capped = Math.min(grown, BACKOFF_CAP_MS);
  return capped + Math.floor(random() * BACKOFF_BASE_MS);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readErrorExcerpt(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const excerpt = text.slice(0, 500);
    return excerpt ? ` body: ${excerpt}` : "";
  } catch {
    return "";
  }
}

/**
 * Embed one text via Azure OpenAI. Same exported signature as the old
 * local engine, so callers are untouched. Never fabricates a vector:
 * missing config, empty text, dim mismatch, or exhausted retries throw.
 */
export async function embedText(
  text: string,
  fetcher: typeof fetch = fetch,
  env: Env = process.env,
  sleep: (ms: number) => Promise<void> = defaultSleep,
  random: () => number = Math.random,
): Promise<number[]> {
  if (!text.trim()) throw new Error("embedding text is empty");
  const config = readConfig(env);
  const url = `${config.endpoint}/openai/deployments/${config.deployment}/embeddings?api-version=${encodeURIComponent(config.apiVersion)}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (attempt > 0) await sleep(backoffDelayMs(attempt - 1, random));
    const response = await fetcher(url, {
      method: "POST",
      headers: { "api-key": config.apiKey, "content-type": "application/json" },
      // No `dimensions` field: Azure must return native 1536-dim vectors.
      body: JSON.stringify({ input: text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      if (retryableStatus(response.status) && attempt < MAX_RETRIES) continue;
      const excerpt = await readErrorExcerpt(response);
      throw new Error(`azure embedding request failed with status ${response.status}${excerpt}`);
    }
    const parsed = azureEmbeddingResponse.safeParse(await response.json());
    const raw = parsed.success ? parsed.data.data[0]?.embedding : undefined;
    if (!raw) throw new Error("azure embedding response did not match the schema");
    if (raw.length !== EMBEDDING_DIM) {
      throw new Error(`embedding dimension ${raw.length}, expected ${EMBEDDING_DIM}`);
    }
    const vector = normalizeEmbedding(raw);
    assertUnitVector(vector);
    return vector;
  }
  throw new Error("azure embedding request failed");
}
