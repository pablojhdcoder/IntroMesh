import { canonicalContextText, canonicalGlobalText, sha256, shouldNormalize } from "@/domain/identity/canonical";
import { cleanIdentity, identityDraftSchema, structuredIdentitySchema, type StructuredIdentity } from "@/domain/identity/schema";
import { toProfileInput } from "@/domain/identity/to-profile";
import { isPresenceLive, nextExpiry } from "@/domain/presence";
import { modelConfigured, newId } from "@/lib/meta/explain";
import { normalizeDescription } from "@/lib/meta/normalize";
import type { FileStore } from "@/lib/store/file-store";
import { slugify } from "@/server/match-profile";
import { scheduleEmbedding } from "@/server/recommendations";

function publicEvent(database: Awaited<ReturnType<FileStore["read"]>>, eventId: string) {
  const event = database.events.find((item) => item.id === eventId);
  if (!event) return null;
  const now = Date.now();
  return {
    ...event,
    attendees: database.presence.filter(
      (item) => item.eventId === event.id && (item.source === "demo" || isPresenceLive(item, now)),
    ).length,
  };
}

export function onboardingActions(store: FileStore) {
  return {
    async listEvents(query = "") {
      const database = await store.read();
      const needle = query.trim().toLowerCase();
      return database.events
        .filter((event) => {
          if (event.status === "ended") return false;
          if (!needle) return true;
          return [event.name, event.description, event.category, event.code, event.id].join(" ").toLowerCase().includes(needle);
        })
        .map((event) => publicEvent(database, event.id));
    },

    async createEvent(
      ownerId: string | null,
      input: { name: string; description: string; category: string; startsAt: string | null },
    ) {
      const name = input.name.trim();
      if (process.env.INTROMESH_ALLOW_EVENT_CREATE !== "1") return { error: "forbidden" as const };
      if (name.length < 2) return { error: "name" as const };
      return store.update((database) => {
        const id = `event-${newId()}`;
        const event = {
          id,
          name,
          demo: false,
          description: input.description.trim(),
          category: input.category.trim(),
          startsAt: input.startsAt,
          code: `${slugify(name) || "evento"}-${id.slice(-6)}`,
          status: "live" as const,
          createdBy: ownerId,
        };
        database.events.push(event);
        return publicEvent(database, id);
      });
    },

    async resolveEvent(code: string) {
      const database = await store.read();
      const needle = code.trim().toLowerCase();
      const event = database.events.find((item) => item.code.toLowerCase() === needle || item.id.toLowerCase() === needle);
      if (!event) return { error: "missing" as const };
      if (event.status === "ended") return { error: "ended" as const };
      return { event: publicEvent(database, event.id) };
    },

    async normalizeIdentity(profileId: string | null, displayName: string, description: string, regenerate = false) {
      const draft = identityDraftSchema.parse({ displayName, description });
      const userId = profileId ?? `user-${newId()}`;
      const prepared = await store.update((database) => {
        const current = database.identities.find((item) => item.userId === userId) ?? null;
        if (!shouldNormalize(current, draft.description, regenerate)) {
          database.metrics.normalizationReuses += 1;
          return { userId, identity: current?.generated ?? null, reused: true as const };
        }
        return { userId, identity: null, reused: false as const };
      });
      if (prepared.reused) return { userId: prepared.userId, identity: prepared.identity, source: "cache" as const, metaConfigured: modelConfigured() };
      if (!modelConfigured()) {
        await store.update((database) => {
          const previous = database.identities.find((item) => item.userId === prepared.userId);
          database.identities = database.identities.filter((item) => item.userId !== prepared.userId).concat({
            userId: prepared.userId,
            displayName: draft.displayName,
            originalDescription: draft.description,
            inputHash: sha256(draft.description.trim()),
            generated: previous?.generated ?? null,
            confirmed: previous?.confirmed ?? null,
            revision: previous?.revision ?? 0,
            status: "draft",
            source: null,
            updatedAt: new Date().toISOString(),
          });
        });
        return { error: "meta" as const, userId: prepared.userId };
      }
      const started = Date.now();
      const normalized = await normalizeDescription({ displayName: draft.displayName, description: draft.description });
      await store.update((database) => {
        const previous = database.identities.find((item) => item.userId === userId);
        const next = {
          userId,
          displayName: draft.displayName,
          originalDescription: draft.description,
          inputHash: sha256(draft.description.trim()),
          generated: normalized.identity,
          confirmed: previous?.confirmed ?? null,
          revision: previous?.revision ?? 0,
          status: "generated" as const,
          source: "model" as const,
          updatedAt: new Date().toISOString(),
        };
        database.identities = database.identities.filter((item) => item.userId !== userId).concat(next);
        database.metrics.normalizationCalls += 1;
        database.metrics.latencyMs += Date.now() - started;
        if (normalized.usage.input) database.metrics.inputTokens += normalized.usage.input;
        if (normalized.usage.output) database.metrics.outputTokens += normalized.usage.output;
      });
      return { userId, identity: normalized.identity, source: "model" as const, metaConfigured: true };
    },

    async confirmIdentity(profileId: string, identity: StructuredIdentity) {
      const confirmed = cleanIdentity(structuredIdentitySchema.parse(identity), identity.display_name);
      return store.update((database) => {
        const record = database.identities.find((item) => item.userId === profileId);
        if (!record) return { error: "identity" as const };
        const edited = JSON.stringify(confirmed) !== JSON.stringify(record.generated);
        record.confirmed = confirmed;
        record.displayName = confirmed.display_name.trim() || record.displayName;
        record.status = "confirmed";
        record.source = edited ? "user" : "model";
        record.revision += 1;
        record.updatedAt = new Date().toISOString();
        const profileInput = toProfileInput({
          displayName: record.displayName,
          identity: confirmed,
          intent: "",
        });
        const existing = database.profiles.find((item) => item.id === profileId && !item.demo);
        const profile = {
          ...profileInput,
          id: profileId,
          slug: existing?.slug ?? `${slugify(profileInput.displayName) || "persona"}-${profileId.slice(-8)}`,
          demo: false,
          presentation: existing?.presentation ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        database.profiles = database.profiles.filter((item) => item.id !== profileId).concat(profile);
        database.recommendations = database.recommendations.filter(
          (item) => item.viewerId !== profileId && item.candidateId !== profileId,
        );
        scheduleEmbedding(
          database,
          { kind: "global", userId: profileId, eventId: null, text: canonicalGlobalText(confirmed), revision: record.revision },
          Date.now(),
        );
        return { profileId, revision: record.revision };
      });
    },

    async joinEvent(profileId: string, eventId: string, intent: string, consent: boolean) {
      const now = Date.now();
      return store.update((database) => {
        const profile = database.profiles.find((item) => item.id === profileId && !item.demo);
        const event = database.events.find((item) => item.id === eventId);
        const identity = database.identities.find((item) => item.userId === profileId && item.status === "confirmed");
        if (!profile || !identity?.confirmed) return { error: "identity" as const };
        if (!event) return { error: "missing" as const };
        if (event.status === "ended") return { error: "ended" as const };
        const text = canonicalContextText({
          intent: intent.trim(),
          lookingFor: identity.confirmed.looking_for,
          collaboration: [],
          eventName: event.name,
          eventCategory: event.category,
          eventDescription: event.description,
        });
        const previous = database.participations.find((item) => item.userId === profileId && item.eventId === eventId);
        const participation = {
          userId: profileId,
          eventId,
          intentText: intent.trim(),
          lookingFor: identity.confirmed.looking_for,
          collaborationInterests: [],
          revision: (previous?.revision ?? 0) + 1,
          inputHash: sha256(text),
          consent,
          visibility: consent ? ("discoverable" as const) : ("hidden" as const),
          status: "joined" as const,
          updatedAt: new Date(now).toISOString(),
        };
        database.participations = database.participations
          .filter((item) => !(item.userId === profileId && item.eventId === eventId))
          .concat(participation);
        if (intent.trim()) {
          scheduleEmbedding(
            database,
            { kind: "event", userId: profileId, eventId, text, revision: participation.revision },
            now,
          );
        }
        database.recommendations = database.recommendations.filter(
          (item) => item.eventId !== eventId || (item.viewerId !== profileId && item.candidateId !== profileId),
        );
        database.presence = database.presence.filter((item) => !(item.profileId === profileId && item.source === "session"));
        if (consent) {
          database.presence.push({
            profileId,
            eventId,
            status: "active",
            source: "session",
            updatedAt: new Date(now).toISOString(),
            expiresAt: nextExpiry(now),
          });
        }
        const seeking = intent.trim() || identity.confirmed.looking_for.join(", ");
        if (seeking) profile.seeking = seeking.slice(0, 500);
        return { event: publicEvent(database, eventId) };
      });
    },
  };
}
