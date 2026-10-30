import { DEMO_EVENT_ID } from "@/domain/catalog";
import type { GroundedExplanation } from "@/domain/ground";
import { selectCandidates } from "@/domain/matching/select-candidates";
import { isPresenceLive } from "@/domain/presence";
import { explainAffinity } from "@/lib/meta/explain";
import type { FileStore } from "@/lib/store/file-store";

export function explainActions(store: FileStore) {
  return {
    async affinity(profileId: string, otherId: string, regenerate = false): Promise<
      { error: "profile" | "match" | "presence" } | { explanation: GroundedExplanation; cached: boolean }
    > {
      const now = Date.now();
      const database = await store.read();
      const viewer = database.profiles.find((item) => item.id === profileId);
      const other = database.profiles.find((item) => item.id === otherId);
      if (!viewer || !other) return { error: "profile" };
      const viewerLive = database.presence.some(
        (record) => record.profileId === viewer.id && record.eventId === DEMO_EVENT_ID && isPresenceLive(record, now),
      );
      const otherLive = database.presence.some(
        (record) => record.profileId === other.id && record.eventId === DEMO_EVENT_ID && isPresenceLive(record, now),
      );
      if (!viewerLive || !otherLive) return { error: "presence" };
      const [match] = selectCandidates(
        {
          id: viewer.id,
          displayName: viewer.displayName,
          discoverable: true,
          goals: [viewer.goal],
          interests: viewer.interests,
          skills: viewer.skills,
          seeking: viewer.seeking,
        },
        [
          {
            id: other.id,
            displayName: other.displayName,
            discoverable: true,
            goals: [other.goal],
            interests: other.interests,
            skills: other.skills,
          },
        ],
        1,
      );
      if (!match) return { error: "match" };
      const key = [viewer.id, other.id, viewer.goal, match.shared.interests.join("|"), match.complement.join("|")].join(
        ":",
      );
      const cached = database.affinity.find((item) => item.key === key);
      if (cached && !regenerate) return { explanation: cached.value, cached: true };
      const explanation = await explainAffinity({
        viewer,
        other,
        shared: match.shared,
        complement: match.complement,
        confidence: match.confidence,
      });
      await store.update((next) => {
        next.affinity = next.affinity.filter((item) => item.key !== key).concat({ key, value: explanation });
        const marker = `view:${viewer.id}:${other.id}`;
        if (!next.analytics.some((item) => item.id === marker)) {
          const topic = match.shared.interests[0] ?? null;
          next.analytics.push(
            {
              id: marker,
              eventId: DEMO_EVENT_ID,
              type: "profile_viewed",
              at: new Date().toISOString(),
              topic,
            },
            {
              id: `rec:${viewer.id}:${other.id}`,
              eventId: DEMO_EVENT_ID,
              type: "recommendation_shown",
              at: new Date().toISOString(),
              topic,
            },
          );
        }
      });
      return { explanation, cached: false };
    },
  };
}
