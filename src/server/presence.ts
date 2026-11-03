import { nextExpiry, type PresenceStatus } from "@/domain/presence";
import type { Store } from "@/lib/store";

type TouchPresence = (
  profileId: string,
  eventId: string,
  enabled: boolean,
  seeking: boolean,
) => Promise<{ status: PresenceStatus | "invisible" } | { error: "profile" }>;

export function presenceActions(store: Store) {
  return {
    async setPresence(profileId: string, eventId: string, enabled: boolean, seeking: boolean) {
      // Hot path (keepalive + toggles): a scoped row write with no snapshot.
      const fast = (store as Store & { touchPresence?: TouchPresence }).touchPresence;
      if (fast) return fast(profileId, eventId, enabled, seeking);
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
