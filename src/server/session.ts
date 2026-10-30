import { profileInputSchema, toPublicProfile, toSharedCard, type Presentation, type ProfileInput, type StoredProfile } from "@/domain/profile";
import { modelConfigured, newId } from "@/lib/meta/explain";
import { persistenceMode, type Store } from "@/lib/store";
import { slugify } from "@/server/match-profile";

export function sessionActions(store: Store) {
  return {
    async session(profileId: string | null) {
      const database = await store.read();
      const profile = database.profiles.find((item) => item.id === profileId) ?? null;
      const identity = profileId ? (database.identities.find((item) => item.userId === profileId) ?? null) : null;
      const legacy = Boolean(profile && !profile.demo && !identity);
      const confirmed = Boolean((identity?.status === "confirmed" && identity.confirmed) || legacy);
      const participation = profileId
        ? (database.participations.find((item) => item.userId === profileId && item.status === "joined") ?? null)
        : null;
      const legacyPresence = profile
        ? (database.presence.find((item) => item.profileId === profile.id && item.source === "session") ?? null)
        : null;
      const legacyEvent = legacy ? (database.events[0]?.id ?? null) : null;
      const eventId = participation?.eventId ?? legacyPresence?.eventId ?? legacyEvent;
      const event = eventId ? (database.events.find((item) => item.id === eventId) ?? null) : null;
      const ready = confirmed && Boolean(event);
      return {
        profile: confirmed && profile ? toPublicProfile(profile) : null,
        needsSetup: !ready,
        identityConfirmed: confirmed,
        draft:
          identity && !confirmed
            ? {
                displayName: identity.displayName,
                description: identity.originalDescription,
                identity: identity.generated,
              }
            : null,
        metaConfigured: modelConfigured(),
        canCreateEvent: process.env.INTROMESH_ALLOW_EVENT_CREATE === "1",
        persistence: persistenceMode(),
        event: ready ? event : null,
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

    async profileBySlug(slug: string) {
      const database = await store.read();
      const profile = database.profiles.find((item) => item.slug === slug);
      return profile ? toSharedCard(profile) : null;
    },
  };
}
