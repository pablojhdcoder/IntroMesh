import { isPresenceLive } from "@/domain/presence";
import { MIN_FINAL_SCORE, RECOMMENDATION_LIMIT } from "@/domain/matching/hybrid";
import type { Database } from "@/lib/store";
import {
  buildRecommendationIndex,
  refreshViewerRecommendations,
  scoreCandidateRecord,
  type RecommendationIndex,
} from "@/server/recommendations";

function liveViewersInEvent(database: Database, eventId: string, now: number): string[] {
  const seen = new Set<string>();
  for (const record of database.presence) {
    if (record.eventId !== eventId || !isPresenceLive(record, now)) continue;
    seen.add(record.profileId);
  }
  return [...seen];
}

function byScoreDesc(
  left: { finalScore: number; candidateId: string },
  right: { finalScore: number; candidateId: string },
): number {
  return right.finalScore - left.finalScore || left.candidateId.localeCompare(right.candidateId);
}

/**
 * Write path, single owner: the embedding worker is the only caller.
 * Rebuilds one viewer's top-8 for one event after that viewer's embedding
 * completed. Retrieval is top-24 by global vector similarity (HNSW via
 * match_candidates_by_embedding in prod, brute-force retrieveBySimilarity
 * in the memory store); scoring is the unchanged hybrid formula.
 */
export function recomputeViewerOnEmbedding(
  database: Database,
  viewerId: string,
  eventId: string,
  now = Date.now(),
): boolean {
  return refreshViewerRecommendations(database, viewerId, eventId, now);
}

/**
 * Inserts one fresh candidate against every other live viewer in the event
 * that already has a completed global vector. Each pair is scored exactly
 * once; the viewer's list stays sorted by finalScore and capped at 8
 * (the newcomer evicts the last row only when it scores higher and clears
 * MIN_FINAL_SCORE). Never walks pairs outside this event.
 */
export function insertCandidateAgainstViewers(
  database: Database,
  candidateId: string,
  eventId: string,
  now = Date.now(),
): number {
  const index: RecommendationIndex = buildRecommendationIndex(database);
  const event = index.eventById.get(eventId);
  const candidate = database.profiles.find((item) => item.id === candidateId);
  if (!event || !candidate) return 0;
  const candidateHasVector = index.globalVectorByUser.get(candidateId) != null;
  if (!candidateHasVector) return 0;
  let inserted = 0;
  for (const viewerId of liveViewersInEvent(database, eventId, now)) {
    if (viewerId === candidateId) continue;
    if (index.globalVectorByUser.get(viewerId) == null) continue;
    const viewer = database.profiles.find((item) => item.id === viewerId);
    if (!viewer) continue;
    const record = scoreCandidateRecord(index, event, viewer, candidate, now);
    if (record.finalScore < MIN_FINAL_SCORE) continue;
    const current = database.recommendations.filter(
      (item) => item.eventId === eventId && item.viewerId === viewerId,
    );
    const next = current
      .filter((item) => item.candidateId !== candidateId)
      .concat(record)
      .sort(byScoreDesc)
      .slice(0, RECOMMENDATION_LIMIT);
    if (!next.some((item) => item.candidateId === candidateId)) continue;
    database.recommendations = database.recommendations
      .filter((item) => !(item.eventId === eventId && item.viewerId === viewerId))
      .concat(next);
    database.metrics.recommendationsCalculated += 1;
    inserted += 1;
  }
  return inserted;
}
