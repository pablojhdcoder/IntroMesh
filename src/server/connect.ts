import { DEMO_EVENT_ID } from "@/domain/catalog";
import { toSharedCard } from "@/domain/profile";
import { newId } from "@/lib/meta/explain";
import type { Database, Store } from "@/lib/store";

type ConnectionsFastStore = Store & {
  readConnectionsSnapshot?: (profileId: string, eventId: string) => Promise<Database>;
};

export function connectActions(store: Store) {
  return {
    async connections(profileId: string, eventId = DEMO_EVENT_ID) {
      const fast = store as ConnectionsFastStore;
      const database =
        typeof fast.readConnectionsSnapshot === "function"
          ? await fast.readConnectionsSnapshot(profileId, eventId)
          : await store.read();
      const byId = new Map(database.profiles.map((profile) => [profile.id, profile]));
      return database.connections
        .filter((item) => item.eventId === eventId && (item.fromId === profileId || item.toId === profileId))
        .flatMap((item) => {
          const otherId = item.fromId === profileId ? item.toId : item.fromId;
          const other = byId.get(otherId);
          if (!other) return [];
          return [{ ...item, other: toSharedCard(other) }];
        });
    },

    async requestConnection(profileId: string, otherId: string, intro: string, introSource: "model" | "user") {
      return store.update((database) => {
        if (introSource !== "model" && introSource !== "user") return { error: "forbidden" as const };
        const existing = database.connections.find(
          (item) => item.fromId === profileId && item.toId === otherId && item.status !== "declined",
        );
        if (existing) return existing;
        const other = database.profiles.find((item) => item.id === otherId);
        const eventId =
          database.participations.find((item) => item.userId === profileId && item.status === "joined")?.eventId ??
          database.presence.find((item) => item.profileId === profileId && item.source === "session")?.eventId ??
          DEMO_EVENT_ID;
        const record = {
          id: `cx-${newId()}`,
          eventId,
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
          eventId,
          type: "intro_requested" as const,
          at: record.createdAt,
          topic: other?.interests[0] ?? null,
        });
        return record;
      });
    },

    async resolveConnection(profileId: string, connectionId: string, action: "accept" | "decline") {
      return store.update((database) => {
        const connection = database.connections.find((item) => item.id === connectionId);
        if (!connection) return { error: "missing" as const };
        // Only the real recipient accepts or declines. No demo bypass.
        if (connection.toId !== profileId) return { error: "forbidden" as const };
        const acceptedAt = action === "accept" ? new Date().toISOString() : null;
        connection.status = action === "accept" ? "accepted" : "declined";
        connection.acceptedAt = acceptedAt;
        if (acceptedAt) {
          const target = database.profiles.find((item) => item.id === connection.toId);
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
  };
}
