import { goalLabel } from "@/domain/catalog";
import { AZURE_EMBEDDING_MODEL_ID, AZURE_EMBEDDING_REVISION, EMBEDDING_DIM, cosineSimilarityUnit } from "@/domain/embedding/azure";
import { isModelCurrent } from "@/domain/embedding/jobs";
import { canonicalContextText, canonicalGlobalText, sha256, RANKING_VERSION } from "@/domain/identity/canonical";
import { upsertEmbeddingJob } from "@/domain/embedding/jobs";
import {
  MIN_FINAL_SCORE,
  RECOMMENDATION_LIMIT,
  confidenceForScore,
  retrieveBySimilarity,
  scorePair,
  semanticCompatibility,
  type HybridProfile,
} from "@/domain/matching/hybrid";
import type { Database, EventRecord, GlobalIdentityRecord, ParticipationRecord, RecommendationRecord } from "@/lib/store";
import type { StoredProfile } from "@/domain/profile";

export type RecommendationIndex = {
  identityByUser: Map<string, GlobalIdentityRecord>;
  participationByUserEvent: Map<string, ParticipationRecord>;
  globalVectorByUser: Map<string, number[]>;
  eventVectorByUserEvent: Map<string, number[]>;
  memberByProfileEvent: Map<string, ParticipationRecord>;
  eventById: Map<string, EventRecord>;
};

function setFirst<K, V>(map: Map<K, V>, key: K, value: V): void {
  if (!map.has(key)) map.set(key, value);
}

// PK-backed tables are unique per key, so first-match maps are exactly equivalent
// to the previous .find() scans, at O(1) per lookup instead of O(n).
export function buildRecommendationIndex(database: Database): RecommendationIndex {
  const identityByUser = new Map<string, GlobalIdentityRecord>();
  for (const item of database.identities) setFirst(identityByUser, item.userId, item);
  const participationByUserEvent = new Map<string, ParticipationRecord>();
  for (const item of database.participations) {
    setFirst(participationByUserEvent, `${item.userId}::${item.eventId}`, item);
  }
  const globalVectorByUser = new Map<string, number[]>();
  const eventVectorByUserEvent = new Map<string, number[]>();
  for (const item of database.embeddings) {
    if (item.status !== "completed" || !item.vector) continue;
    // Stale-provider vectors must never score: legacy model id/revision or
    // wrong dims (e.g. pre-Azure 384-dim rows) are skipped, never ranked.
    if (!isModelCurrent(item)) continue;
    if (item.vector.length !== EMBEDDING_DIM) continue;
    if (item.kind === "global") setFirst(globalVectorByUser, item.userId, item.vector);
    else if (item.eventId) setFirst(eventVectorByUserEvent, `${item.userId}::${item.eventId}`, item.vector);
  }
  const memberByProfileEvent = new Map<string, ParticipationRecord>();
  for (const item of database.participations) {
    if (item.status !== "joined") continue;
    setFirst(memberByProfileEvent, `${item.userId}::${item.eventId}`, item);
  }
  const eventById = new Map<string, EventRecord>();
  for (const item of database.events) setFirst(eventById, item.id, item);
  return {
    identityByUser,
    participationByUserEvent,
    globalVectorByUser,
    eventVectorByUserEvent,
    memberByProfileEvent,
    eventById,
  };
}

function globalHashIndexed(
  index: RecommendationIndex,
  userId: string,
): { hash: string; revision: number; vector: number[] | null } {
  const identity = index.identityByUser.get(userId);
  const confirmed = identity?.status === "confirmed" ? identity : null;
  const text = confirmed?.confirmed ? canonicalGlobalText(confirmed.confirmed) : "";
  return {
    hash: text ? sha256(text) : "",
    revision: confirmed?.revision ?? 0,
    vector: index.globalVectorByUser.get(userId) ?? null,
  };
}

function contextHashIndexed(
  index: RecommendationIndex,
  userId: string,
  eventId: string,
): { hash: string; revision: number; vector: number[] | null } {
  const key = `${userId}::${eventId}`;
  const stored = index.participationByUserEvent.get(key);
  // Parity: the hash/revision path only sees joined participations; the vector lookup does not filter by status.
  const participation = stored?.status === "joined" ? stored : undefined;
  const identity = index.identityByUser.get(userId);
  const event = index.eventById.get(eventId);
  const text =
    participation && event
      ? canonicalContextText({
          intent: participation.intentText,
          lookingFor: identity?.confirmed?.looking_for ?? participation.lookingFor,
          collaboration: participation.collaborationInterests,
          eventName: event.name,
          eventCategory: event.category,
          eventDescription: event.description,
        })
      : "";
  return {
    hash: text ? sha256(text) : (participation?.inputHash ?? ""),
    revision: participation?.revision ?? 0,
    vector: index.eventVectorByUserEvent.get(key) ?? null,
  };
}

function hybridProfileIndexed(
  index: RecommendationIndex,
  profile: StoredProfile,
  eventId: string,
): HybridProfile {
  const identity = index.identityByUser.get(profile.id)?.confirmed;
  const participation = index.participationByUserEvent.get(`${profile.id}::${eventId}`);
  return {
    id: profile.id,
    interests: identity?.interests ?? profile.interests,
    skills: identity?.skills ?? profile.skills,
    lookingFor: identity?.looking_for ?? (profile.seeking ? [profile.seeking] : []),
    canOffer: identity?.can_offer ?? (profile.offers ? [profile.offers] : []),
    focus: identity?.professional_focus ?? [],
    projects: identity?.projects ?? profile.projects,
    intent: participation?.intentText ?? "",
  };
}

function memberIndexed(index: RecommendationIndex, profileId: string, eventId: string): boolean {
  // Visibility is membership: both sides hold a joined participation for
  // this event. Consent/visibility columns are legacy and ignored.
  return index.memberByProfileEvent.has(`${profileId}::${eventId}`);
}

export function scheduleEmbedding(
  database: Database,
  draft: { kind: "global" | "event"; userId: string; eventId: string | null; text: string; revision: number },
  now: number,
): void {
  const next = upsertEmbeddingJob(
    database.embeddings,
    {
      kind: draft.kind,
      userId: draft.userId,
      eventId: draft.eventId,
      inputHash: sha256(draft.text),
      profileRevision: draft.revision,
      modelId: AZURE_EMBEDDING_MODEL_ID,
      modelRevision: AZURE_EMBEDDING_REVISION,
    },
    now,
  );
  database.embeddings = next.records;
  if (next.action === "reused") database.metrics.embeddingsReused += 1;
}

/** Recomendaciones de un visor contra el evento. No recorre parejas ajenas. */
export function refreshViewerRecommendations(
  database: Database,
  viewerId: string,
  eventId: string,
  now = Date.now(),
): boolean {
  const ranked = rankViewerCandidates(database, viewerId, eventId, now);
  if (!ranked) return false;
  const existing = database.recommendations.filter((item) => item.eventId === eventId && item.viewerId === viewerId);
  // Steady room: same pool, same inputs → same ranking. Skip the rewrite so a
  // plain discovery stays a zero-write update (no persist, no lock).
  if (sameRecommendations(existing, ranked.records)) return false;
  database.recommendations = database.recommendations
    .filter((item) => !(item.eventId === eventId && item.viewerId === viewerId))
    .concat(ranked.records);
  database.metrics.recommendationsCalculated += ranked.records.length;
  return true;
}

/** Case-insensitive exact overlap, preserving the viewer's own labels. */
function overlapLabels(left: readonly string[], right: readonly string[]): string[] {
  const wanted = new Set(right.map((item) => item.toLowerCase()));
  const seen = new Set<string>();
  const shared: string[] = [];
  for (const item of left) {
    const key = item.toLowerCase();
    if (!wanted.has(key) || seen.has(key)) continue;
    seen.add(key);
    shared.push(item);
  }
  return shared;
}

/**
 * Human-readable evidence for one scored pair. Same goal id on both sides
 * becomes its catalog label; interests/skills intersect exactly; complement
 * is what the viewer is looking for that the candidate offers, minus what
 * they already share.
 */
export function evidenceLabels(
  viewer: HybridProfile,
  candidate: HybridProfile,
  viewerGoal: string,
  candidateGoal: string,
): {
  sharedGoalLabels: string[];
  sharedInterestLabels: string[];
  sharedSkillLabels: string[];
  complementLabels: string[];
} {
  const sharedInterestLabels = overlapLabels(viewer.interests, candidate.interests);
  const sharedSkillLabels = overlapLabels(viewer.skills, candidate.skills);
  const sharedGoalLabels = viewerGoal && viewerGoal === candidateGoal ? [goalLabel(viewerGoal)] : [];
  const sharedSkillKeys = new Set(sharedSkillLabels.map((item) => item.toLowerCase()));
  const complementLabels = overlapLabels(viewer.lookingFor, candidate.skills).filter(
    (item) => !sharedSkillKeys.has(item.toLowerCase()),
  );
  return { sharedGoalLabels, sharedInterestLabels, sharedSkillLabels, complementLabels };
}

/** Score one viewer/candidate pair with the hybrid formula. Never invents text. */
export function scoreCandidateRecord(
  index: RecommendationIndex,
  event: EventRecord,
  viewer: StoredProfile,
  candidate: StoredProfile,
  now: number,
): RecommendationRecord {
  const viewerGlobal = globalHashIndexed(index, viewer.id);
  const candidateGlobal = globalHashIndexed(index, candidate.id);
  const viewerContext = contextHashIndexed(index, viewer.id, event.id);
  const candidateContext = contextHashIndexed(index, candidate.id, event.id);
  const viewerHybrid = hybridProfileIndexed(index, viewer, event.id);
  const candidateHybrid = hybridProfileIndexed(index, candidate, event.id);
  const identity =
    viewerGlobal.vector && candidateGlobal.vector
      ? cosineSimilarityUnit(viewerGlobal.vector, candidateGlobal.vector)
      : null;
  const context =
    viewerContext.vector && candidateContext.vector
      ? cosineSimilarityUnit(viewerContext.vector, candidateContext.vector)
      : null;
  const scored = scorePair(viewerHybrid, candidateHybrid, event, { identity, context });
  const labels = evidenceLabels(viewerHybrid, candidateHybrid, viewer.goal, candidate.goal);
  return {
    eventId: event.id,
    viewerId: viewer.id,
    candidateId: candidate.id,
    identitySimilarity: scored.identitySimilarity,
    contextSimilarity: scored.contextSimilarity,
    cosineDistance: scored.cosineDistance,
    goalCompatibility: scored.goalCompatibility,
    skillComplementarity: scored.skillComplementarity,
    sharedInterests: scored.sharedInterests,
    eventRelevance: scored.eventRelevance,
    finalScore: scored.finalScore,
    confidence: confidenceForScore({
      semantic: semanticCompatibility(scored.identitySimilarity, scored.contextSimilarity),
      goal: scored.goalCompatibility,
      skill: scored.skillComplementarity,
      interest: scored.sharedInterests,
      event: scored.eventRelevance,
    }),
    sharedGoalLabels: labels.sharedGoalLabels,
    sharedInterestLabels: labels.sharedInterestLabels,
    sharedSkillLabels: labels.sharedSkillLabels,
    complementLabels: labels.complementLabels,
    rankingVersion: RANKING_VERSION,
    viewerHash: viewerGlobal.hash,
    candidateHash: candidateGlobal.hash,
    viewerContextHash: viewerContext.hash,
    candidateContextHash: candidateContext.hash,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}

/** Pure ranking for one viewer: pool, hybrid scores, cutoff, order, limit. */
function rankViewerCandidates(
  database: Database,
  viewerId: string,
  eventId: string,
  now: number,
): { records: RecommendationRecord[] } | null {
  const index = buildRecommendationIndex(database);
  const event = index.eventById.get(eventId);
  const viewer = database.profiles.find((item) => item.id === viewerId);
  if (!event || !viewer) return null;
  const viewerGlobal = globalHashIndexed(index, viewerId);
  const pool = database.profiles.filter((item) => item.id !== viewerId && memberIndexed(index, item.id, eventId));
  const retrieved = retrieveBySimilarity(
    viewerGlobal.vector,
    pool.map((item) => ({ item, vector: globalHashIndexed(index, item.id).vector })),
  );
  database.metrics.vectorSearches += 1;
  const records = retrieved
    .map((entry) => scoreCandidateRecord(index, event, viewer, entry.item, now))
    .filter((item) => item.finalScore >= MIN_FINAL_SCORE)
    .sort((a, b) => b.finalScore - a.finalScore || a.candidateId.localeCompare(b.candidateId))
    .slice(0, RECOMMENDATION_LIMIT);
  return { records };
}

/** Same candidates in the same order from the same inputs (timestamps excluded). */
function sameRecommendations(current: RecommendationRecord[], next: RecommendationRecord[]): boolean {
  if (current.length !== next.length) return false;
  return current.every((item, position) => {
    const other = next[position];
    return (
      other !== undefined &&
      other.candidateId === item.candidateId &&
      other.rankingVersion === item.rankingVersion &&
      other.viewerHash === item.viewerHash &&
      other.candidateHash === item.candidateHash &&
      other.viewerContextHash === item.viewerContextHash &&
      other.candidateContextHash === item.candidateContextHash &&
      other.identitySimilarity === item.identitySimilarity &&
      other.contextSimilarity === item.contextSimilarity &&
      other.cosineDistance === item.cosineDistance &&
      other.goalCompatibility === item.goalCompatibility &&
      other.skillComplementarity === item.skillComplementarity &&
      other.sharedInterests === item.sharedInterests &&
      other.eventRelevance === item.eventRelevance &&
      other.finalScore === item.finalScore &&
      joined(other.sharedGoalLabels) === joined(item.sharedGoalLabels) &&
      joined(other.sharedInterestLabels) === joined(item.sharedInterestLabels) &&
      joined(other.sharedSkillLabels) === joined(item.sharedSkillLabels) &&
      joined(other.complementLabels) === joined(item.complementLabels)
    );
  });
}

function joined(values: readonly string[]): string {
  return [...values].sort().join("\n");
}

export function recommendationEvidence(record: RecommendationRecord): string {
  return [
    record.identitySimilarity,
    record.contextSimilarity,
    record.goalCompatibility,
    record.skillComplementarity,
    record.sharedInterests,
    record.finalScore,
    record.rankingVersion,
    [...record.sharedGoalLabels].sort().join(","),
    [...record.sharedInterestLabels].sort().join(","),
    [...record.sharedSkillLabels].sort().join(","),
    [...record.complementLabels].sort().join(","),
  ].join("|");
}

export function semanticOf(record: RecommendationRecord): number | null {
  return semanticCompatibility(record.identitySimilarity, record.contextSimilarity);
}

export function confidenceOf(record: RecommendationRecord): "low" | "medium" | "high" {
  return confidenceForScore({
    semantic: semanticOf(record),
    goal: record.goalCompatibility,
    skill: record.skillComplementarity,
    interest: record.sharedInterests,
    event: null,
  });
}
