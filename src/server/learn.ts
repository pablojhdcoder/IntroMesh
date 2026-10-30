import { aggregateActivity } from "@/domain/analytics";
import { DEMO_EVENT_ID } from "@/domain/catalog";
import { isPresenceLive } from "@/domain/presence";
import { newId } from "@/lib/meta/explain";
import type { Store } from "@/lib/store";

export function learnActions(store: Store) {
  return {
    async share(profileId: string, method: "link" | "qr" | "nfc") {
      const type = method === "link" ? "share_link" : method === "qr" ? "share_qr" : "share_nfc";
      await store.update((database) => {
        const eventId =
          database.participations.find((item) => item.userId === profileId && item.status === "joined")?.eventId ??
          database.presence.find((item) => item.profileId === profileId && item.source === "session")?.eventId ??
          DEMO_EVENT_ID;
        database.analytics.push({
          id: `share-${newId()}`,
          eventId,
          type,
          at: new Date().toISOString(),
          topic: null,
        });
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
        engine: database.metrics,
      };
    },
  };
}
