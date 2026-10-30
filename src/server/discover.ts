import { DEMO_EVENT_ID, goalLabel } from "@/domain/catalog";
import { mapSignalGraph } from "@/domain/embedding/graph-map";
import { cosineSimilarity, embedProfile, rankBySimilarity } from "@/domain/embedding/vector";
import { selectCandidates } from "@/domain/matching/select-candidates";
import { toSharedCard } from "@/domain/profile";
import { isPresenceLive, nextExpiry } from "@/domain/presence";
import type { FileStore } from "@/lib/store/file-store";
import { asMatch } from "@/server/match-profile";
import { confidenceOf, refreshViewerRecommendations } from "@/server/recommendations";

export function discoverActions(store: FileStore) {
  return {
    async discover(profileId: string, eventId = DEMO_EVENT_ID) {
      const now = Date.now();
      return store.update((database) => {
        for (const record of database.presence) {
          if (record.source !== "demo") continue;
          record.updatedAt = new Date(now).toISOString();
          record.expiresAt = nextExpiry(now, 1000 * 60 * 60 * 6);
        }
        database.presence = database.presence.filter(
          (record) => record.source === "demo" || isPresenceLive(record, now),
        );
        const viewer = database.profiles.find((item) => item.id === profileId);
        if (!viewer) return { error: "profile" as const };
        refreshViewerRecommendations(database, profileId, eventId, now);
        const live = new Map(
          database.presence.filter((record) => record.eventId === eventId).map((record) => [record.profileId, record]),
        );
        const pool = database.profiles.filter((item) => live.has(item.id));
        const viewerMatch = asMatch(viewer);
        const viewerVector = embedProfile(viewerMatch);
        const others = pool.filter((item) => item.id !== viewer.id);
        const embedded = others.map((item) => {
          const match = asMatch(item);
          return { item, match, vector: embedProfile(match) };
        });
        const neighborhood = new Set(
          rankBySimilarity(
            viewerVector,
            embedded.map((entry) => ({ item: entry.item, vector: entry.vector })),
            { limit: 18 },
          ).map((entry) => entry.item.id),
        );
        const ranked = selectCandidates(
          viewerMatch,
          embedded.map((entry) => entry.match),
          8,
        );
        const recommended = new Map(ranked.map((item) => [item.profile.id, item]));
        const shown = [
          ...embedded.filter((entry) => recommended.has(entry.item.id)),
          ...embedded
            .filter((entry) => !recommended.has(entry.item.id) && neighborhood.has(entry.item.id))
            .sort(
              (a, b) =>
                cosineSimilarity(viewerVector, b.vector) - cosineSimilarity(viewerVector, a.vector) ||
                a.item.id.localeCompare(b.item.id),
            ),
        ].slice(0, 18);
        const points = new Map(
          mapSignalGraph(
            shown.map((entry) => ({
              id: entry.item.id,
              vector: entry.vector,
              similarity: cosineSimilarity(viewerVector, entry.vector),
            })),
          ).map((point) => [point.id, point]),
        );
        const people = shown.map((entry) => {
          const match = recommended.get(entry.item.id);
          const point = points.get(entry.item.id) ?? { x: 50, y: 50 };
          const persisted = database.recommendations.find(
            (item) => item.eventId === eventId && item.viewerId === viewer.id && item.candidateId === entry.item.id,
          );
          const viewerVectorReady = database.embeddings.some(
            (item) => item.kind === "global" && item.userId === viewer.id && item.status === "completed" && item.vector,
          );
          const candidateVectorReady = database.embeddings.some(
            (item) => item.kind === "global" && item.userId === entry.item.id && item.status === "completed" && item.vector,
          );
          const hybrid = viewerVectorReady && candidateVectorReady && persisted ? persisted : null;
          return {
            ...toSharedCard(entry.item),
            x: point.x,
            y: point.y,
            presence: live.get(entry.item.id)?.status ?? "active",
            recommendation: hybrid
              ? {
                  score: hybrid.finalScore,
                  confidence: confidenceOf(hybrid),
                  shared: {
                    goals: match?.shared.goals.map(goalLabel) ?? [],
                    interests: match?.shared.interests ?? [],
                    skills: match?.shared.skills ?? [],
                  },
                  complement: match?.complement ?? [],
                }
              : match
              ? {
                  score: match.score,
                  confidence: match.confidence,
                  shared: {
                    goals: match.shared.goals.map(goalLabel),
                    interests: match.shared.interests,
                    skills: match.shared.skills,
                  },
                  complement: match.complement,
                }
              : null,
          };
        });
        const self = live.get(viewer.id);
        return {
          event: database.events.find((item) => item.id === eventId) ?? null,
          presence: self?.status ?? "invisible",
          people: self ? people : [],
        };
      });
    },
  };
}
