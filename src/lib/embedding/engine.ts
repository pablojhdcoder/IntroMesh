import { assertUnitVector, E5_MODEL_ID, prefixEmbeddingText } from "@/domain/embedding/e5";

type Extractor = (text: string, options: { pooling: "mean"; normalize: true }) => Promise<{ data: ArrayLike<number> }>;

let pipelinePromise: Promise<Extractor> | null = null;

/** Una sola carga del modelo por proceso. No se descarga en cada request. */
export function getEmbeddingPipeline(): Promise<Extractor> {
  pipelinePromise ??= (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    return (await pipeline("feature-extraction", E5_MODEL_ID)) as Extractor;
  })();
  return pipelinePromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(prefixEmbeddingText(text), { pooling: "mean", normalize: true });
  const vector = Array.from(output.data, (value) => Number(value));
  assertUnitVector(vector);
  return vector;
}
