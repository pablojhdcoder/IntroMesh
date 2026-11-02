import { E5_MODEL_ID, E5_REVISION, cosineSimilarityUnit } from "@/domain/embedding/e5";
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
import { isPresenceLive, type PresenceRecord } from "@/domain/presence";
import type { Database, EventRecord, GlobalIdentityRecord, ParticipationRecord, RecommendationRecord } from "@/lib/store";
import type { StoredProfile } from "@/domain/profile";

type RecommendationIndex = {
  identityByUser: Map<string, GlobalIdentityRecord>;
  participationByUserEvent: Map<string, ParticipationRecord>;
  globalVectorByUser: Map<string, number[]>;
  eventVectorByUserEvent: Map<string, number[]>;
  presenceByProfileEvent: Map<string, PresenceRecord>;
  eventById: Map<string, EventRecord>;
};

function setFirst<K, V>(map: Map<K, V>, key: K, value: V): void {
  if (!map.has(key)) map.set(key, value);
}

// PK-backed tables are unique per key, so first-match maps are exactly equivalent
// to the previous .find() scans, at O(1) per lookup instead of O(n).
function buildRecommendationIndex(database: Database): RecommendationIndex {
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
    if (item.kind === "global") setFirst(globalVectorByUser, item.userId, item.vector);
    else if (item.eventId) setFirst(eventVectorByUserEvent, `${item.userId}::${item.eventId}`, item.vector);
  }
  const presenceByProfileEvent = new Map<string, PresenceRecord>();
  for (const item of database.presence) {
    setFirst(presenceByProfileEvent, `${item.profileId}::${item.eventId}`, item);
  }
  const eventById = new Map<string, EventRecord>();
  for (const item of database.events) setFirst(eventById, item.id, item);
  return {
    identityByUser,
    participationByUserEvent,
    globalVectorByUser,
    eventVectorByUserEvent,
    presenceByProfileEvent,
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

function visibleIndexed(
  index: RecommendationIndex,
  profile: StoredProfile,
  eventId: string,
  now: number,
): boolean {
  const presence = index.presenceByProfileEvent.get(`${profile.id}::${eventId}`);
  if (!presence || (presence.source !== "demo" && !isPresenceLive(presence, now))) return false;
  if (profile.demo) return true;
  const participation = index.participationByUserEvent.get(`${profile.id}::${eventId}`);
  if (!participation) return true;
  return participation.status === "joined" && participation.consent && participation.visibility === "discoverable";
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
      modelId: E5_MODEL_ID,
      modelRevision: E5_REVISION,
    },
    now,
  );
  database.embeddings = next.records;
  if (next.action === "reused") database.metrics.embeddingsReused += 1;
}

/** Recomendaciones de un visor contra el evento. No recorre parejas ajenas. */
export function refreshViewerRecommendations(database: Database, viewerId: string, eventId: string, now = Date.now()): void {
  const index = buildRecommendationIndex(database);
  const event = index.eventById.get(eventId);
  const viewer = database.profiles.find((item) => item.id === viewerId);
  if (!event || !viewer) return;
  const viewerGlobal = globalHashIndexed(index, viewerId);
  const viewerContext = contextHashIndexed(index, viewerId, eventId);
  const pool = database.profiles.filter((item) => item.id !== viewerId && visibleIndexed(index, item, eventId, now));
  const retrieved = retrieveBySimilarity(
    viewerGlobal.vector,
    pool.map((item) => ({ item, vector: globalHashIndexed(index, item.id).vector })),
  );
  database.metrics.vectorSearches += 1;
  const ranked = retrieved
    .map((entry) => {
      const candidateGlobal = globalHashIndexed(index, entry.item.id);
      const candidateContext = contextHashIndexed(index, entry.item.id, eventId);
      const identity =
        viewerGlobal.vector && candidateGlobal.vector ? cosineSimilarityUnit(viewerGlobal.vector, candidateGlobal.vector) : null;
      const context =
        viewerContext.vector && candidateContext.vector
          ? cosineSimilarityUnit(viewerContext.vector, candidateContext.vector)
          : null;
      const scored = scorePair(hybridProfileIndexed(index, viewer, eventId), hybridProfileIndexed(index, entry.item, eventId), event, {
        identity,
        context,
      });
      const record: RecommendationRecord = {
        eventId,
        viewerId,
        candidateId: entry.item.id,
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
        sharedGoalLabels: [],
        sharedInterestLabels: [],
        sharedSkillLabels: [],
        complementLabels: [],
        rankingVersion: RANKING_VERSION,
        viewerHash: viewerGlobal.hash,
        candidateHash: candidateGlobal.hash,
        viewerContextHash: viewerContext.hash,
        candidateContextHash: candidateContext.hash,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      };
      return record;
    })
    .filter((item) => item.finalScore >= MIN_FINAL_SCORE)
    .sort((a, b) => b.finalScore - a.finalScore || a.candidateId.localeCompare(b.candidateId))
    .slice(0, RECOMMENDATION_LIMIT);
  database.recommendations = database.recommendations
    .filter((item) => !(item.eventId === eventId && item.viewerId === viewerId))
    .concat(ranked);
  database.metrics.recommendationsCalculated += ranked.length;
  for (const item of ranked) {
    const id = `gen:${item.eventId}:${item.viewerId}:${item.candidateId}`;
    if (database.analytics.some((event) => event.id === id)) continue;
    database.analytics.push({
      id,
      eventId,
      type: "recommendation_shown",
      at: new Date(now).toISOString(),
      topic: null,
    });
  }
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
