/**
 * Azure OpenAI `text-embedding-3-small`, native 1536 dims.
 *
 * No `dimensions` param is ever sent: Azure returns native vectors
 * (1536 < pgvector HNSW max 2000). No text prefix is added: Azure has no
 * legacy query-prefix convention, so canonical hashes changed with the
 * provider and every pre-Azure vector is stale — detected via model
 * id/revision mismatch and re-embedded, never reused.
 */
export const AZURE_EMBEDDING_MODEL_ID = "text-embedding-3-small";
export const AZURE_EMBEDDING_REVISION = "azure-te3small-1536-v1";
export const EMBEDDING_DIM = 1536;

export function assertUnitVector(vector: readonly number[], dimensions = EMBEDDING_DIM): void {
  if (vector.length !== dimensions) {
    throw new Error(`embedding dimension ${vector.length}, expected ${dimensions}`);
  }
  const norm = Math.hypot(...vector);
  if (norm === 0 || Math.abs(norm - 1) > 1e-2) {
    throw new Error("embedding is not L2-normalized");
  }
}

/** L2-normalize any non-empty, non-zero vector. Throws on zero/empty input. */
export function normalizeEmbedding(vector: readonly number[]): number[] {
  if (vector.length === 0) throw new Error("embedding is empty");
  const norm = Math.hypot(...vector);
  if (norm === 0 || !Number.isFinite(norm)) throw new Error("embedding is not normalizable");
  return vector.map((value) => value / norm);
}

/** Distancia de coseno de pgvector (`<=>`) para vectores ya normalizados: 1 - producto escalar. */
export function cosineDistance(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length) {
    throw new Error(`embedding dimension mismatch ${left.length} vs ${right.length}`);
  }
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) dot += (left[index] ?? 0) * (right[index] ?? 0);
  return 1 - dot;
}

export function cosineSimilarityUnit(left: readonly number[], right: readonly number[]): number {
  return 1 - cosineDistance(left, right);
}

// Legacy export kept for reference only. The read path never uses it: the
// single source of truth for vector search is the
// `match_candidates_by_embedding` RPC in
// supabase/migrations/0006_azure_embeddings_1536.sql. Do not add new callers.
export const VECTOR_SEARCH_SQL = `
select user_id, (embedding <=> $1) as distance
from profile_embeddings
where status = 'completed'
  and user_id = any($2::text[])
order by embedding <=> $1
limit $3
`.trim();
