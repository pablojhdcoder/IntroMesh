import { aggregateActivity } from "@/domain/analytics";
import { DEMO_EVENT_ID } from "@/domain/catalog";
import { newId } from "@/lib/meta/explain";
import type { Store } from "@/lib/store";

export function learnActions(store: Store) {
  return {
    async share(profileId: string, method: "link" | "qr" | "vcard") {
      const type = method === "link" ? "share_link" : method === "qr" ? "share_qr" : "share_vcard";
      await store.update((database) => {
        const eventId =
          database.participations.find((item) => item.userId === profileId && item.status === "joined")?.eventId ??
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
      const database = await store.read();
      const members = database.participations.filter(
        (record) => record.eventId === eventId && record.status === "joined",
      ).length;
      return {
        event: database.events.find((item) => item.id === eventId) ?? null,
        demo: true,
        report: aggregateActivity({
          events: database.analytics.filter((item) => item.eventId === eventId),
          visible: members,
        }),
        engine: database.metrics,
      };
    },
  };
}
