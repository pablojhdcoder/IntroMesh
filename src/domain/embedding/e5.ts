/**
 * intfloat/multilingual-e5-small vía Transformers.js.
 * 384 dimensiones, mean pooling y normalización L2 los aplica el pipeline.
 * Los dos perfiles usan el prefijo `query: `: la comparación es simétrica.
 * No se usa el par query/passage de la recuperación asimétrica.
 */
export const E5_MODEL_ID = "Xenova/multilingual-e5-small";
export const E5_SOURCE_MODEL = "intfloat/multilingual-e5-small";
export const E5_REVISION = "e5-query-symmetric-v1";
export const E5_DIM = 384;
export const E5_PREFIX = "query: ";

export function prefixEmbeddingText(text: string): string {
  const body = text.trim();
  return body.startsWith(E5_PREFIX) ? body : `${E5_PREFIX}${body}`;
}

export function assertUnitVector(vector: readonly number[], dimensions = E5_DIM): void {
  if (vector.length !== dimensions) {
    throw new Error(`embedding dimension ${vector.length}, expected ${dimensions}`);
  }
  const norm = Math.hypot(...vector);
  if (norm === 0 || Math.abs(norm - 1) > 1e-2) {
    throw new Error("embedding is not L2-normalized");
  }
}

/** Distancia de coseno de pgvector (`<=>`) para vectores ya normalizados: 1 - producto escalar. */
export function cosineDistance(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) dot += left[index] * right[index];
  return 1 - dot;
}

export function cosineSimilarityUnit(left: readonly number[], right: readonly number[]): number {
  return 1 - cosineDistance(left, right);
}

export const VECTOR_SEARCH_SQL = `
select user_id, (embedding <=> $1) as distance
from profile_embeddings
where status = 'completed'
  and user_id = any($2::text[])
order by embedding <=> $1
limit $3
`.trim();
