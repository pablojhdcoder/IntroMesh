import { DEMO_EVENT_ID } from "@/domain/catalog";
import { toSharedCard } from "@/domain/profile";
import { newId } from "@/lib/meta/explain";
import type { Database, Store } from "@/lib/store";

type ConnectionsFastStore = Store & {
  readConnectionsSnapshot?: (profileId: string, eventId: string) => Promise<Database>;
};

export function connectActions(store: Store) {
  return {
    async connections(profileId: string, eventId?: string) {
      const fast = store as ConnectionsFastStore;
      const database =
        eventId !== undefined && typeof fast.readConnectionsSnapshot === "function"
          ? await fast.readConnectionsSnapshot(profileId, eventId)
          : await store.read();
      const byId = new Map(database.profiles.map((profile) => [profile.id, profile]));
      const eventNameById = new Map(database.events.map((event) => [event.id, event.name]));
      return database.connections
        .filter(
          (item) =>
            (eventId === undefined || item.eventId === eventId) &&
            (item.fromId === profileId || item.toId === profileId),
        )
        .flatMap((item) => {
          const otherId = item.fromId === profileId ? item.toId : item.fromId;
          const other = byId.get(otherId);
          if (!other) return [];
          return [{ ...item, eventName: eventNameById.get(item.eventId) ?? null, other: toSharedCard(other) }];
        });
    },

    async requestConnection(
      profileId: string,
      otherId: string,
      intro: string,
      introSource: "model" | "user",
      eventId?: string,
    ) {
      return store.update((database) => {
        if (introSource !== "model" && introSource !== "user") return { error: "forbidden" as const };
        if (eventId !== undefined) {
          const joined = database.participations.some(
            (item) => item.userId === profileId && item.eventId === eventId && item.status === "joined",
          );
          const peerJoined = database.participations.some(
            (item) => item.userId === otherId && item.eventId === eventId && item.status === "joined",
          );
          if (!joined || !peerJoined) return { error: "event" as const };
        }
        const existing = database.connections.find(
          (item) =>
            ((item.fromId === profileId && item.toId === otherId) ||
              (item.fromId === otherId && item.toId === profileId)) &&
            (item.status === "pending" || item.status === "accepted"),
        );
        if (existing) return existing;
        const resolvedEventId =
          eventId ??
          database.participations.find((item) => item.userId === profileId && item.status === "joined")?.eventId ??
          DEMO_EVENT_ID;
        const record = {
          id: `cx-${newId()}`,
          eventId: resolvedEventId,
          fromId: profileId,
          toId: otherId,
          status: "pending" as const,
          intro,
          introSource,
          createdAt: new Date().toISOString(),
          acceptedAt: null,
        };
        database.connections.push(record);
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
        return { connection };
      });
    },
  };
}
