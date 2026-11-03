import { nextExpiry, type PresenceStatus } from "@/domain/presence";
import type { Store } from "@/lib/store";

type TouchPresence = (
  profileId: string,
  eventId: string,
) => Promise<{ status: PresenceStatus } | { error: "profile" }>;

export function presenceActions(store: Store) {
  return {
    // Social model (Option A): heartbeat only. Join = visible, Leave = hidden.
    // There are no invisible/active/seeking modes. This only refreshes live
    // presence for a joined participation; it never resurrects a left event.
    async setPresence(profileId: string, eventId: string) {
      // Hot path (keepalive): a scoped row write with no snapshot.
      const fast = (store as Store & { touchPresence?: TouchPresence }).touchPresence;
      if (fast) return fast(profileId, eventId);
      const now = Date.now();
      return store.update((database) => {
        const profile = database.profiles.find((item) => item.id === profileId && !item.demo);
        if (!profile) return { error: "profile" as const };
        const participation = database.participations.find((item) => item.userId === profileId && item.eventId === eventId);
        // Heartbeat is presence-only: it requires a joined participation and
        // never mutates membership. Join/leave own consent and visibility.
        // A left event stays left: presence must never resurrect it.
        if (!participation || participation.status !== "joined") return { error: "profile" as const };
        database.presence = database.presence.filter(
          (record) => !(record.profileId === profileId && record.eventId === eventId && record.source === "session"),
        );
        const status: PresenceStatus = "active";
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
