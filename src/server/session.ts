import { profileInputSchema, toPublicProfile, toSharedCard, type Presentation, type ProfileInput, type StoredProfile } from "@/domain/profile";
import { modelConfigured, newId } from "@/lib/meta/explain";
import { persistenceMode, type Database, type Store } from "@/lib/store";

type SessionFastStore = Store & {
  readSessionSnapshot?: (profileId: string | null) => Promise<Database>;
  readProfileCardSnapshot?: (slug: string) => Promise<Database>;
};

async function readForSession(store: Store, profileId: string | null): Promise<Database> {
  const fast = store as SessionFastStore;
  if (typeof fast.readSessionSnapshot === "function") return fast.readSessionSnapshot(profileId);
  return store.read();
}
import { slugify } from "@/server/match-profile";

export function sessionActions(store: Store) {
  return {
    async session(profileId: string | null) {
      const database = await readForSession(store, profileId);
      const profile = database.profiles.find((item) => item.id === profileId) ?? null;
      const account = profileId ? (database.accounts.find((item) => item.userId === profileId) ?? null) : null;
      const identity = profileId ? (database.identities.find((item) => item.userId === profileId) ?? null) : null;
      const legacy = Boolean(profile && !profile.demo && !identity);
      const confirmed = Boolean((identity?.status === "confirmed" && identity.confirmed) || legacy);
      const participation = profileId
        ? (database.participations.find((item) => item.userId === profileId && item.status === "joined") ?? null)
        : null;
      const legacyEvent = legacy ? (database.events[0]?.id ?? null) : null;
      const eventId = participation?.eventId ?? legacyEvent;
      const event = eventId ? (database.events.find((item) => item.id === eventId) ?? null) : null;
      const ready = confirmed && Boolean(event);
      const memberships = profileId
        ? database.participations
            .filter((item) => item.userId === profileId)
            .flatMap((item) => {
              const membershipEvent = database.events.find((candidate) => candidate.id === item.eventId);
              if (!membershipEvent) return [];
              return [
                {
                  eventId: item.eventId,
                  status: item.status,
                  joinedAt: item.joinedAt ?? item.updatedAt,
                  event: {
                    id: membershipEvent.id,
                    name: membershipEvent.name,
                    demo: membershipEvent.demo,
                    description: membershipEvent.description,
                    category: membershipEvent.category,
                    startsAt: membershipEvent.startsAt,
                    code: membershipEvent.code,
                    status: membershipEvent.status,
                  },
                  memberCount: database.participations.filter(
                    (candidate) => candidate.eventId === item.eventId && candidate.status === "joined",
                  ).length,
                },
              ];
            })
        : [];
      return {
        profile: confirmed && profile ? toPublicProfile(profile) : null,
        account: account ? { username: account.username } : null,
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
        memberships,
      };
    },

    async saveProfile(profileId: string | null, input: ProfileInput, presentation: Presentation | null) {
      const parsed = profileInputSchema.parse(input);
      return store.update((database) => {
        const existing = database.profiles.find((item) => item.id === profileId && !item.demo);
        const id = existing?.id ?? `user-${newId()}`;
        const account = database.accounts.find((item) => item.userId === id) ?? null;
        const username = account?.username ?? existing?.username ?? null;
        const slug =
          existing?.slug ??
          (username && !existing ? username : `${slugify(parsed.displayName)}-${id.slice(5, 13)}`);
        const profile: StoredProfile = {
          ...parsed,
          id,
          slug,
          username,
          demo: false,
          presentation: presentation ?? existing?.presentation ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        database.profiles = database.profiles.filter((item) => item.id !== id).concat(profile);
        return toPublicProfile(profile);
      });
    },

    async profileBySlug(slug: string, viewerId: string | null = null) {
      const fast = store as SessionFastStore;
      const database =
        typeof fast.readProfileCardSnapshot === "function" ? await fast.readProfileCardSnapshot(slug) : await store.read();
      const profile = database.profiles.find((item) => item.slug === slug);
      if (!profile) return null;
      // Private global profiles are hidden from everyone but their owner,
      // including the unauthenticated card/QR/vCard surfaces.
      if ((profile.profileVisibility ?? "public") === "private" && viewerId !== profile.id) return null;
      return toSharedCard(profile);
    },
  };
}
