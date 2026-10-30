import { nextExpiry, type PresenceStatus } from "@/domain/presence";
import type { FileStore } from "@/lib/store/file-store";

export function presenceActions(store: FileStore) {
  return {
    async setPresence(profileId: string, eventId: string, enabled: boolean, seeking: boolean) {
      const now = Date.now();
      return store.update((database) => {
        const profile = database.profiles.find((item) => item.id === profileId && !item.demo);
        if (!profile) return { error: "profile" as const };
        database.presence = database.presence.filter(
          (record) => !(record.profileId === profileId && record.source === "session"),
        );
        if (!enabled) {
          const participation = database.participations.find((item) => item.userId === profileId && item.eventId === eventId);
          if (participation) {
            participation.consent = false;
            participation.visibility = "hidden";
            participation.updatedAt = new Date(now).toISOString();
          }
          return { status: "invisible" as const };
        }
        const status: PresenceStatus = seeking ? "seeking" : "active";
        const participation = database.participations.find((item) => item.userId === profileId && item.eventId === eventId);
        if (participation) {
          participation.consent = true;
          participation.visibility = "discoverable";
          participation.status = "joined";
          participation.updatedAt = new Date(now).toISOString();
        }
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
  };
}
