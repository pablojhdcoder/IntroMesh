import { toPublicProfile, toSharedCard } from "@/domain/profile";
import type { Store } from "@/lib/store";

export function profileActions(store: Store) {
  return {
    async publicProfile(username: string, viewerId: string | null) {
      const database = await store.read();
      const profile = database.profiles.find((item) => item.slug === username);
      if (!profile) return null;
      const isOwner = Boolean(viewerId && viewerId === profile.id);
      const visibility = profile.profileVisibility ?? "public";
      if (visibility === "private" && !isOwner) return null;
      const connectionCount = database.connections.filter(
        (item) =>
          item.status === "accepted" && (item.fromId === profile.id || item.toId === profile.id),
      ).length;
      return {
        ...toSharedCard(profile),
        avatarUrl: profile.avatarUrl ?? null,
        username: profile.username ?? profile.slug,
        isOwner,
        connectionCount,
        profileVisibility: visibility,
      };
    },

    async updateProfileSettings(
      profileId: string,
      input: { avatarUrl?: string | null; profileVisibility?: "public" | "private" },
    ) {
      return store.update((database) => {
        const profile = database.profiles.find((item) => item.id === profileId);
        if (!profile) return { error: "profile" as const };
        if (input.avatarUrl !== undefined) profile.avatarUrl = input.avatarUrl;
        if (input.profileVisibility !== undefined) profile.profileVisibility = input.profileVisibility;
        return toPublicProfile(profile);
      });
    },
  };
}
