import { goalLabel } from "@/domain/catalog";
import { aggregateActivity } from "@/domain/analytics";
import type { GroundedExplanation } from "@/domain/ground";
import { selectCandidates } from "@/domain/matching/select-candidates";
import {
  profileInputSchema,
  toPublicProfile,
  toSharedCard,
  type Presentation,
  type ProfileInput,
  type StoredProfile,
} from "@/domain/profile";
import { isPresenceLive, nextExpiry, type PresenceStatus } from "@/domain/presence";
import { explainAffinity, modelConfigured, newId } from "@/lib/meta/explain";
import type { FileStore } from "@/lib/store/file-store";
import { DEMO_EVENT_ID } from "@/domain/catalog";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function layout(index: number, total: number) {
  const innerCount = Math.min(8, total);
  const outer = index >= innerCount;
  const count = outer ? Math.max(total - innerCount, 1) : innerCount;
  const slot = outer ? index - innerCount : index;
  const radius = outer ? 42 : 26;
  const angle = (slot / count) * Math.PI * 2 - Math.PI / 2 + (outer ? 0.2 : 0);
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius * 0.82;
  return {
    x: Math.round(Math.min(76, Math.max(24, x)) * 10) / 10,
    y: Math.round(Math.min(78, Math.max(22, y)) * 10) / 10,
  };
}

export function createService(store: FileStore) {
  return {
    async session(profileId: string | null) {
      const database = await store.read();
      const profile = database.profiles.find((item) => item.id === profileId) ?? null;
      return {
        profile: profile ? toPublicProfile(profile) : null,
        needsSetup: !profile || profile.demo,
        metaConfigured: modelConfigured(),
        persistence: "file" as const,
        event: database.events[0] ?? null,
      };
    },

    async saveProfile(profileId: string | null, input: ProfileInput, presentation: Presentation | null) {
      const parsed = profileInputSchema.parse(input);
      return store.update((database) => {
        const existing = database.profiles.find((item) => item.id === profileId && !item.demo);
        const id = existing?.id ?? `user-${newId()}`;
        const profile: StoredProfile = {
          ...parsed,
          id,
          slug: existing?.slug ?? `${slugify(parsed.displayName)}-${id.slice(5, 13)}`,
          demo: false,
          presentation: presentation ?? existing?.presentation ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        database.profiles = database.profiles.filter((item) => item.id !== id).concat(profile);
        return toPublicProfile(profile);
      });
    },

    async setPresence(profileId: string, eventId: string, enabled: boolean, seeking: boolean) {
      const now = Date.now();
      return store.update((database) => {
        const profile = database.profiles.find((item) => item.id === profileId && !item.demo);
        if (!profile) return { error: "profile" as const };
        database.presence = database.presence.filter(
          (record) => !(record.profileId === profileId && record.source === "session"),
        );
        if (!enabled) return { status: "invisible" as const };
        const status: PresenceStatus = seeking ? "seeking" : "active";
        database.presence.push({
          profileId,
          eventId,
          status,
          source: "session",
          updatedAt: new Date(now).toISOString(),
          expiresAt: nextExpiry(now),
        });
        return { status };
      });
    },

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
        const live = new Map(
          database.presence.filter((record) => record.eventId === eventId).map((record) => [record.profileId, record]),
        );
        const pool = database.profiles.filter((item) => live.has(item.id));
        const ranked = selectCandidates(
          {
            id: viewer.id,
            displayName: viewer.displayName,
            discoverable: true,
            goals: [viewer.goal],
            interests: viewer.interests,
            skills: viewer.skills,
            seeking: viewer.seeking,
          },
          pool.map((item) => ({
            id: item.id,
            displayName: item.displayName,
            discoverable: true,
            goals: [item.goal],
            interests: item.interests,
            skills: item.skills,
            demo: item.demo,
          })),
          8,
        );
        const recommended = new Map(ranked.map((item) => [item.profile.id, item]));
        const others = pool.filter((item) => item.id !== viewer.id);
        const shown = [
          ...others.filter((item) => recommended.has(item.id)),
          ...others.filter((item) => !recommended.has(item.id)),
        ].slice(0, 18);
        const people = shown.map((item, index, list) => {
            const match = recommended.get(item.id);
            const point = layout(index, list.length);
            return {
              ...toSharedCard(item),
              x: point.x,
              y: point.y,
              presence: live.get(item.id)?.status ?? "active",
              recommendation: match
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

    async connections(profileId: string, eventId = DEMO_EVENT_ID) {
      const database = await store.read();
      return database.connections
        .filter(
          (item) => item.eventId === eventId && (item.fromId === profileId || item.toId === profileId),
        )
        .flatMap((item) => {
          const otherId = item.fromId === profileId ? item.toId : item.fromId;
          const other = database.profiles.find((profile) => profile.id === otherId);
          if (!other) return [];
          return [{ ...item, other: toSharedCard(other) }];
        });
    },

    async requestConnection(profileId: string, otherId: string, intro: string, introSource: "model" | "demo" | "user") {
      return store.update((database) => {
        const existing = database.connections.find(
          (item) => item.fromId === profileId && item.toId === otherId && item.status !== "declined",
        );
        if (existing) return existing;
        const other = database.profiles.find((item) => item.id === otherId);
        const record = {
          id: `cx-${newId()}`,
          eventId: DEMO_EVENT_ID,
          fromId: profileId,
          toId: otherId,
          status: "pending" as const,
          intro,
          introSource,
          createdAt: new Date().toISOString(),
          acceptedAt: null,
        };
        database.connections.push(record);
        database.analytics.push({
          id: `req-${record.id}`,
          eventId: DEMO_EVENT_ID,
          type: "intro_requested",
          at: record.createdAt,
          topic: other?.interests[0] ?? null,
        });
        return record;
      });
    },

    async resolveConnection(profileId: string, connectionId: string, action: "accept" | "decline", simulateDemo: boolean) {
      return store.update((database) => {
        const connection = database.connections.find((item) => item.id === connectionId);
        if (!connection) return { error: "missing" as const };
        const target = database.profiles.find((item) => item.id === connection.toId);
        const allowed = connection.toId === profileId || (simulateDemo && target?.demo && connection.fromId === profileId);
        if (!allowed) return { error: "forbidden" as const };
        const acceptedAt = action === "accept" ? new Date().toISOString() : null;
        connection.status = action === "accept" ? "accepted" : "declined";
        connection.acceptedAt = acceptedAt;
        if (acceptedAt) {
          database.analytics.push({
            id: `ok-${connection.id}`,
            eventId: connection.eventId,
            type: "connection_accepted",
            at: acceptedAt,
            topic: target?.interests[0] ?? null,
          });
        }
        return { connection };
      });
    },

    async share(profileId: string, method: "link" | "qr" | "nfc") {
      const type = method === "link" ? "share_link" : method === "qr" ? "share_qr" : "share_nfc";
      await store.update((database) => {
        database.analytics.push({
          id: `share-${newId()}`,
          eventId: DEMO_EVENT_ID,
          type,
          at: new Date().toISOString(),
          topic: null,
        });
        void profileId;
      });
    },

    async intelligence(eventId = DEMO_EVENT_ID) {
      const now = Date.now();
      const database = await store.read();
      const visible = database.presence.filter(
        (record) => record.eventId === eventId && (record.source === "demo" || isPresenceLive(record, now)),
      ).length;
      return {
        event: database.events.find((item) => item.id === eventId) ?? null,
        demo: true,
        report: aggregateActivity({
          events: database.analytics.filter((item) => item.eventId === eventId),
          visible,
        }),
      };
    },

    async profileBySlug(slug: string) {
      const database = await store.read();
      const profile = database.profiles.find((item) => item.slug === slug);
      return profile ? toSharedCard(profile) : null;
    },
  };
}

export type IntroMeshService = ReturnType<typeof createService>;
