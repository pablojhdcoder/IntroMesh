import { assertUnitVector, E5_MODEL_ID, prefixEmbeddingText } from "@/domain/embedding/e5";

type Embedder = (text: string) => Promise<number[]>;

let singleton: Promise<Embedder> | null = null;

function asVector(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error("embedding output shape");
  if (value.length > 0 && Array.isArray(value[0])) return asVector(value[0]);
  return value.map((item) => {
    if (typeof item !== "number") throw new Error("embedding output shape");
    return item;
  });
}

async function loadEmbedder(): Promise<Embedder> {
  const imported = await import("@huggingface/transformers");
  const extractor = await imported.pipeline("feature-extraction", E5_MODEL_ID);
  return async (text: string) => {
    const output = await extractor(prefixEmbeddingText(text), { pooling: "mean", normalize: true });
    const listed = typeof output.tolist === "function" ? output.tolist() : output;
    const vector = asVector(listed);
    assertUnitVector(vector);
    return vector;
  };
}

/** Una sola carga del modelo por proceso. No se descarga en cada request. */
export function getEmbedder(): Promise<Embedder> {
  singleton ??= loadEmbedder().catch((error: unknown) => {
    singleton = null;
    throw error;
  });
  return singleton;
}

export async function embedCanonicalText(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  return embedder(text);
}
