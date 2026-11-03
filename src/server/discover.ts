import { DEMO_EVENT_ID } from "@/domain/catalog";
import { toSharedCard } from "@/domain/profile";
import type { Database, Store } from "@/lib/store";
import { confidenceOf } from "@/server/recommendations";

/** Other joined members surfaced without scores. Bounded payload, bounded layout. */
const DIRECTORY_CAP = 100;

type DiscoveryFastStore = Store & {
  readDiscoverySnapshot?: (profileId: string, eventId: string) => Promise<Database>;
};

/**
 * Deterministic room position from the viewer/candidate pair hash. Stable
 * across renders and processes, no vectors on the read path.
 */
export function pointForPair(viewerId: string, candidateId: string): { x: number; y: number } {
  let hash = 5381;
  const input = `${viewerId}:${candidateId}`;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33 + input.charCodeAt(index)) | 0;
  }
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  const radius = 38;
  const round = (value: number): number => Math.round(value * 100) / 100;
  return { x: round(50 + radius * Math.cos(angle)), y: round(50 + radius * Math.sin(angle)) };
}

export function discoverActions(store: Store) {
  return {
    async discover(profileId: string, eventId = DEMO_EVENT_ID) {
      // Read-only path: membership is visibility, so nothing expires and
      // nothing is written here. Scoring inputs stay on the write path.
      const fast = store as DiscoveryFastStore;
      const database =
        typeof fast.readDiscoverySnapshot === "function"
          ? await fast.readDiscoverySnapshot(profileId, eventId)
          : await store.read();
      const viewer = database.profiles.find((item) => item.id === profileId);
      if (!viewer) return { error: "profile" as const };
      const event = database.events.find((item) => item.id === eventId) ?? null;
      // Social model: visibility = joined membership on both sides.
      // Consent/visibility columns are legacy and ignored; presence is gone.
      const members = new Set(
        database.participations
          .filter((item) => item.eventId === eventId && item.status === "joined")
          .map((item) => item.userId),
      );
      const rows = database.recommendations
        .filter((item) => item.eventId === eventId && item.viewerId === viewer.id)
        .sort((a, b) => b.finalScore - a.finalScore || a.candidateId.localeCompare(b.candidateId))
        .slice(0, 8);
      // Pending comes from the embedding job when one exists (pending or
      // claimed/processing means the vector is not ready yet); completed
      // rows or persisted recommendations mean ready.
      const viewerJob = database.embeddings.find(
        (item) => item.kind === "global" && item.userId === viewer.id,
      );
      const viewerReady = rows.length > 0 || viewerJob?.status === "completed";
      const viewerEmbeddingStatus = viewerReady ? ("ready" as const) : ("pending" as const);
      if (!members.has(viewer.id)) {
        return { event, viewerEmbeddingStatus, people: [], directory: [] };
      }
      const byId = new Map(database.profiles.map((profile) => [profile.id, profile]));
      const recommendedIds = new Set<string>();
      const people = rows.flatMap((row) => {
        const candidate = byId.get(row.candidateId);
        if (!candidate || !members.has(row.candidateId)) return [];
        recommendedIds.add(row.candidateId);
        const point = pointForPair(viewer.id, row.candidateId);
        return [
          {
            ...toSharedCard(candidate),
            x: point.x,
            y: point.y,
            recommendation: {
              score: row.finalScore,
              confidence: confidenceOf(row),
              shared: {
                goals: [...row.sharedGoalLabels],
                interests: [...row.sharedInterestLabels],
                skills: [...row.sharedSkillLabels],
              },
              complement: [...row.complementLabels],
            },
          },
        ];
      });
      const directory = [...members]
        .filter((id) => id !== viewer.id && !recommendedIds.has(id))
        .flatMap((id) => {
          const profile = byId.get(id);
          if (!profile) return [];
          return [toSharedCard(profile)];
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id))
        .slice(0, DIRECTORY_CAP);
      return { event, viewerEmbeddingStatus, people, directory };
    },
  };
}
