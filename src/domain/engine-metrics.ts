export type EngineMetrics = {
  embeddingsGenerated: number;
  embeddingsReused: number;
  vectorSearches: number;
  recommendationsCalculated: number;
  normalizationCalls: number;
  normalizationReuses: number;
  explanationCalls: number;
  cacheHits: number;
  cacheMisses: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  failures: number;
  retries: number;
};

export function emptyMetrics(): EngineMetrics {
  return {
    embeddingsGenerated: 0,
    embeddingsReused: 0,
    vectorSearches: 0,
    recommendationsCalculated: 0,
    normalizationCalls: 0,
    normalizationReuses: 0,
    explanationCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
    failures: 0,
    retries: 0,
  };
}
