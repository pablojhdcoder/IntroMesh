import { MATCH_WEIGHTS, seekingTokens, type MatchProfile } from "@/domain/matching/select-candidates";

/**
 * Embedding local de un perfil ya declarado.
 *
 * Un texto se vuelve un vector fijo y la cercanía es el coseno. No llama a Meta.
 * Esa API no documenta embeddings, así que el vector sale de los atributos con
 * peso explícito (los mismos que la puntuación) mediante feature hashing.
 */

export const EMBEDDING_DIM = 48;

/** Por debajo de esto el vecino no entra en el mapa. El corte es similitud de coseno. */
export const MIN_NEIGHBOR_SIMILARITY = 0.12;

export type WeightedTerm = {
  token: string;
  weight: number;
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function fnv(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function profileTerms(profile: MatchProfile): WeightedTerm[] {
  return [
    ...profile.goals.map((goal) => ({ token: `goal:${normalizeToken(goal)}`, weight: MATCH_WEIGHTS.goal })),
    ...profile.interests.map((interest) => ({
      token: `interest:${normalizeToken(interest)}`,
      weight: MATCH_WEIGHTS.interest,
    })),
    ...profile.skills.map((skill) => ({ token: `skill:${normalizeToken(skill)}`, weight: MATCH_WEIGHTS.skill })),
    ...seekingTokens(profile.seeking).map((token) => ({
      token: `seek:${token}`,
      weight: MATCH_WEIGHTS.complement,
    })),
  ];
}

/** Vector L2-normalizado. Un perfil sin términos queda en el origen. */
export function embedTerms(terms: readonly WeightedTerm[]): number[] {
  const vector = Array.from({ length: EMBEDDING_DIM }, () => 0);
  for (const term of terms) {
    const token = normalizeToken(term.token);
    if (!token || term.weight === 0) continue;
    const bucket = fnv(token) % EMBEDDING_DIM;
    const sign = (fnv(`sign:${token}`) & 1) === 0 ? 1 : -1;
    vector[bucket] += sign * term.weight;
  }
  const norm = Math.hypot(...vector);
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export function embedProfile(profile: MatchProfile): number[] {
  return embedTerms(profileTerms(profile));
}

/** Coseno en [-1, 1]. Los dos vectores se asumen de la misma dimensión y normalizados. */
export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) dot += left[index] * right[index];
  return dot;
}

export type RankedNeighbor<T> = {
  item: T;
  vector: number[];
  similarity: number;
};

/**
 * Recupera un conjunto pequeño por cercanía, como la búsqueda por distancia
 * de coseno: umbral, orden y límite. No puntúa ni explica.
 */
export function rankBySimilarity<T>(
  viewer: readonly number[],
  pool: readonly { item: T; vector: readonly number[] }[],
  options?: { limit?: number; minSimilarity?: number },
): RankedNeighbor<T>[] {
  const minSimilarity = options?.minSimilarity ?? MIN_NEIGHBOR_SIMILARITY;
  const limit = options?.limit ?? pool.length;
  return pool
    .map((entry) => ({
      item: entry.item,
      vector: [...entry.vector],
      similarity: cosineSimilarity(viewer, entry.vector),
    }))
    .filter((entry) => entry.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity || stableId(a.item).localeCompare(stableId(b.item)))
    .slice(0, Math.max(0, limit));
}

function stableId(item: unknown): string {
  if (item && typeof item === "object" && "id" in item && typeof item.id === "string") return item.id;
  return "";
}
