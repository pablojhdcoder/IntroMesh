import { profileInputSchema, toPublicProfile, toSharedCard, type Presentation, type ProfileInput, type StoredProfile } from "@/domain/profile";
import { modelConfigured, newId } from "@/lib/meta/explain";
import type { FileStore } from "@/lib/store/file-store";
import { slugify } from "@/server/match-profile";

export function sessionActions(store: FileStore) {
  return {
    async session(profileId: string | null) {
      const database = await store.read();
      const profile = database.profiles.find((item) => item.id === profileId) ?? null;
      return {
        profile: profile ? toPublicProfile(profile) : null,
        needsSetup: !profile || profile.demo,
        metaConfigured: modelConfigured(),
        persistence: "file" as const,
        event: database.events[0] ?? null,
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
