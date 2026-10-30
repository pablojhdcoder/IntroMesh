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
import { isPresenceLive } from "@/domain/presence";
import type { Database, RecommendationRecord } from "@/lib/store";
import type { StoredProfile } from "@/domain/profile";

function globalHash(database: Database, userId: string): { hash: string; revision: number; vector: number[] | null } {
  const identity = database.identities.find((item) => item.userId === userId && item.status === "confirmed");
  const text = identity?.confirmed ? canonicalGlobalText(identity.confirmed) : "";
  const row = database.embeddings.find((item) => item.kind === "global" && item.userId === userId && item.status === "completed");
  return { hash: text ? sha256(text) : "", revision: identity?.revision ?? 0, vector: row?.vector ?? null };
}

function contextHash(database: Database, userId: string, eventId: string): { hash: string; revision: number; vector: number[] | null } {
  const participation = database.participations.find((item) => item.userId === userId && item.eventId === eventId && item.status === "joined");
  const identity = database.identities.find((item) => item.userId === userId);
  const event = database.events.find((item) => item.id === eventId);
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
  const row = database.embeddings.find(
    (item) => item.kind === "event" && item.userId === userId && item.eventId === eventId && item.status === "completed",
  );
  return { hash: text ? sha256(text) : participation?.inputHash ?? "", revision: participation?.revision ?? 0, vector: row?.vector ?? null };
}

function hybridProfile(database: Database, profile: StoredProfile, eventId: string): HybridProfile {
  const identity = database.identities.find((item) => item.userId === profile.id)?.confirmed;
  const participation = database.participations.find((item) => item.userId === profile.id && item.eventId === eventId);
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

function visible(database: Database, profile: StoredProfile, eventId: string, now: number): boolean {
  const presence = database.presence.find((item) => item.profileId === profile.id && item.eventId === eventId);
  if (!presence || (presence.source !== "demo" && !isPresenceLive(presence, now))) return false;
  if (profile.demo) return true;
  const participation = database.participations.find((item) => item.userId === profile.id && item.eventId === eventId);
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
  const event = database.events.find((item) => item.id === eventId);
  const viewer = database.profiles.find((item) => item.id === viewerId);
  if (!event || !viewer) return;
  const viewerGlobal = globalHash(database, viewerId);
  const viewerContext = contextHash(database, viewerId, eventId);
  const pool = database.profiles.filter((item) => item.id !== viewerId && visible(database, item, eventId, now));
  const retrieved = retrieveBySimilarity(
    viewerGlobal.vector,
    pool.map((item) => ({ item, vector: globalHash(database, item.id).vector })),
  );
  database.metrics.vectorSearches += 1;
  const ranked = retrieved
    .map((entry) => {
      const candidateGlobal = globalHash(database, entry.item.id);
      const candidateContext = contextHash(database, entry.item.id, eventId);
      const identity =
        viewerGlobal.vector && candidateGlobal.vector ? cosineSimilarityUnit(viewerGlobal.vector, candidateGlobal.vector) : null;
      const context =
        viewerContext.vector && candidateContext.vector
          ? cosineSimilarityUnit(viewerContext.vector, candidateContext.vector)
          : null;
      const scored = scorePair(hybridProfile(database, viewer, eventId), hybridProfile(database, entry.item, eventId), event, {
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
