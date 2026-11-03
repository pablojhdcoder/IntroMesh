import type { Database, Store } from "@/lib/store";

function eventSummary(database: Database, eventId: string) {
  const event = database.events.find((item) => item.id === eventId);
  if (!event) return null;
  return {
    id: event.id,
    name: event.name,
    demo: event.demo,
    description: event.description,
    category: event.category,
    startsAt: event.startsAt,
    code: event.code,
    status: event.status,
  };
}

function memberCount(database: Database, eventId: string): number {
  return database.participations.filter((item) => item.eventId === eventId && item.status === "joined").length;
}

export function hubActions(store: Store) {
  return {
    async listMyEvents(profileId: string) {
      const database = await store.read();
      return database.participations
        .filter((item) => item.userId === profileId && item.status === "joined")
        .flatMap((item) => {
          const event = eventSummary(database, item.eventId);
          if (!event) return [];
          return [
            {
              eventId: item.eventId,
              status: item.status,
              joinedAt: item.joinedAt ?? item.updatedAt,
              event,
              memberCount: memberCount(database, item.eventId),
            },
          ];
        });
    },

    async discoverEvents(profileId: string, query = "") {
      const database = await store.read();
      const needle = query.trim().toLowerCase();
      const joinedEventIds = new Set(
        database.participations
          .filter((item) => item.userId === profileId && item.status === "joined")
          .map((item) => item.eventId),
      );
      return database.events
        .filter((event) => {
          if (event.status === "ended") return false;
          if (!needle) return true;
          return [event.name, event.description, event.category, event.code, event.id]
            .join(" ")
            .toLowerCase()
            .includes(needle);
        })
        .map((event) => ({
          ...event,
          attendees: memberCount(database, event.id),
          joined: joinedEventIds.has(event.id),
        }));
    },
  };
}
