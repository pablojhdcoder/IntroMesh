import "server-only";
import { emptyMetrics, type EngineMetrics } from "@/domain/engine-metrics";
import type { AnalyticsRecord } from "@/domain/analytics";
import type { CachedExplanation } from "@/domain/cache/explanations";
import type { EmbeddingRecord } from "@/domain/embedding/jobs";
import type { GroundedExplanation } from "@/domain/ground";
import type { StructuredIdentity } from "@/domain/identity/schema";
import type { Presentation, StoredProfile } from "@/domain/profile";
import type { PresenceRecord } from "@/domain/presence";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  hydrateDatabase,
  type ConnectionRecord,
  type Database,
  type EventRecord,
  type FileStore,
  type GlobalIdentityRecord,
  type ParticipationRecord,
  type RecommendationRecord,
} from "./file-store";

type Admin = ReturnType<typeof createSupabaseAdmin>;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asVector(value: unknown): number[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^\[/, "").replace(/\]$/, "");
    if (!trimmed) return [];
    return trimmed.split(",").map((part) => Number(part.trim()));
  }
  return null;
}

function toVectorValue(vector: number[] | null): number[] | null {
  return vector;
}

function mapProfile(row: Record<string, unknown>, links: { label: string; url: string }[]): StoredProfile {
  return {
    id: String(row.id),
    slug: String(row.slug),
    displayName: String(row.display_name),
    role: String(row.role),
    bio: String(row.bio ?? ""),
    interests: asStringArray(row.interests),
    skills: asStringArray(row.skills),
    projects: asStringArray(row.projects),
    links,
    offers: String(row.offers ?? ""),
    seeking: String(row.seeking ?? ""),
    goal: String(row.goal) as StoredProfile["goal"],
    demo: Boolean(row.demo),
    presentation: (row.presentation as Presentation | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapEvent(row: Record<string, unknown>): EventRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    demo: Boolean(row.demo),
    description: String(row.description ?? ""),
    category: String(row.category ?? ""),
    startsAt: row.starts_at ? String(row.starts_at) : null,
    code: String(row.code ?? row.id),
    status: (row.status as EventRecord["status"]) ?? "live",
    createdBy: row.created_by ? String(row.created_by) : null,
  };
}

async function loadSnapshot(admin: Admin): Promise<Database> {
  const [
    events,
    profiles,
    links,
    presence,
    connections,
    analytics,
    identities,
    participations,
    globalEmbeddings,
    eventEmbeddings,
    recommendations,
    explanations,
    metricsRow,
  ] = await Promise.all([
    admin.from("events").select("*"),
    admin.from("profiles").select("*"),
    admin.from("profile_links").select("*"),
    admin.from("presence").select("*"),
    admin.from("connections").select("*"),
    admin.from("analytics_events").select("*"),
    admin.from("global_identities").select("*"),
    admin.from("event_participations").select("*"),
    admin.from("profile_embeddings").select("*"),
    admin.from("event_context_embeddings").select("*"),
    admin.from("event_match_recommendations").select("*"),
    admin.from("match_explanations").select("*"),
    admin.from("engine_metrics").select("payload").eq("id", 1).maybeSingle(),
  ]);

  if (metricsRow.error?.code === "PGRST205") {
    throw new Error(
      "Missing engine_metrics. Apply supabase/migrations/0004_store_parity.sql in the Supabase SQL editor (see supabase/APPLY.md).",
    );
  }
  const errors = [
    events.error,
    profiles.error,
    links.error,
    presence.error,
    connections.error,
    analytics.error,
    identities.error,
    participations.error,
    globalEmbeddings.error,
    eventEmbeddings.error,
    recommendations.error,
    explanations.error,
    metricsRow.error,
  ].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors.map((item) => item?.message).join("; "));
  }

  const linksByProfile = new Map<string, { label: string; url: string }[]>();
  for (const row of links.data ?? []) {
    const profileId = String(row.profile_id);
    const list = linksByProfile.get(profileId) ?? [];
    list.push({ label: String(row.label), url: String(row.url) });
    linksByProfile.set(profileId, list);
  }

  const embeddings: EmbeddingRecord[] = [
    ...(globalEmbeddings.data ?? []).map((row) => ({
      id: `global:${row.user_id}:global`,
      kind: "global" as const,
      userId: String(row.user_id),
      eventId: null,
      vector: asVector(row.embedding),
      modelId: String(row.model_id),
      modelRevision: String(row.model_revision),
      inputHash: String(row.input_hash),
      profileRevision: Number(row.profile_revision ?? 0),
      status: row.status as EmbeddingRecord["status"],
      attempts: Number(row.attempts ?? 0),
      leaseUntil: row.lease_until ? String(row.lease_until) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      error: row.error ? String(row.error) : null,
    })),
    ...(eventEmbeddings.data ?? []).map((row) => ({
      id: `event:${row.user_id}:${row.event_id}`,
      kind: "event" as const,
      userId: String(row.user_id),
      eventId: String(row.event_id),
      vector: asVector(row.embedding),
      modelId: String(row.model_id),
      modelRevision: String(row.model_revision),
      inputHash: String(row.input_hash),
      profileRevision: Number(row.profile_revision ?? 0),
      status: row.status as EmbeddingRecord["status"],
      attempts: Number(row.attempts ?? 0),
      leaseUntil: row.lease_until ? String(row.lease_until) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      error: row.error ? String(row.error) : null,
    })),
  ];

  return hydrateDatabase({
    events: (events.data ?? []).map((row) => mapEvent(row as Record<string, unknown>)),
    profiles: (profiles.data ?? []).map((row) =>
      mapProfile(row as Record<string, unknown>, linksByProfile.get(String(row.id)) ?? []),
    ),
    presence: (presence.data ?? []).map(
      (row): PresenceRecord => ({
        profileId: String(row.profile_id),
        eventId: String(row.event_id),
        status: row.status as PresenceRecord["status"],
        source: row.source as PresenceRecord["source"],
        updatedAt: String(row.updated_at),
        expiresAt: String(row.expires_at),
      }),
    ),
    connections: (connections.data ?? []).map(
      (row): ConnectionRecord => ({
        id: String(row.id),
        eventId: String(row.event_id),
        fromId: String(row.from_id),
        toId: String(row.to_id),
        status: row.status as ConnectionRecord["status"],
        intro: row.intro ? String(row.intro) : null,
        introSource: (row.intro_source as ConnectionRecord["introSource"]) ?? null,
        createdAt: String(row.created_at),
        acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
      }),
    ),
    analytics: (analytics.data ?? []).map(
      (row): AnalyticsRecord => ({
        id: String(row.id),
        eventId: String(row.event_id),
        type: row.type as AnalyticsRecord["type"],
        topic: row.topic ? String(row.topic) : null,
        at: String(row.at),
      }),
    ),
    identities: (identities.data ?? []).map(
      (row): GlobalIdentityRecord => ({
        userId: String(row.user_id),
        displayName: String(row.display_name),
        originalDescription: String(row.original_description),
        inputHash: String(row.input_hash),
        generated: (row.generated as StructuredIdentity | null) ?? null,
        confirmed: (row.confirmed as StructuredIdentity | null) ?? null,
        revision: Number(row.revision ?? 0),
        status: row.status as GlobalIdentityRecord["status"],
        source: (row.source as GlobalIdentityRecord["source"]) ?? null,
        updatedAt: String(row.updated_at),
      }),
    ),
    participations: (participations.data ?? []).map(
      (row): ParticipationRecord => ({
        userId: String(row.user_id),
        eventId: String(row.event_id),
        intentText: String(row.intent_text ?? ""),
        lookingFor: asStringArray(row.looking_for),
        collaborationInterests: asStringArray(row.collaboration_interests),
        revision: Number(row.revision ?? 0),
        inputHash: String(row.input_hash),
        consent: Boolean(row.consent),
        visibility: row.visibility as ParticipationRecord["visibility"],
        status: row.status as ParticipationRecord["status"],
        updatedAt: String(row.updated_at),
      }),
    ),
    embeddings,
    recommendations: (recommendations.data ?? []).map(
      (row): RecommendationRecord => ({
        eventId: String(row.event_id),
        viewerId: String(row.viewer_id),
        candidateId: String(row.candidate_id),
        identitySimilarity: row.identity_similarity == null ? null : Number(row.identity_similarity),
        contextSimilarity: row.context_similarity == null ? null : Number(row.context_similarity),
        cosineDistance: row.cosine_distance == null ? null : Number(row.cosine_distance),
        goalCompatibility: row.goal_compatibility == null ? null : Number(row.goal_compatibility),
        skillComplementarity: row.skill_complementarity == null ? null : Number(row.skill_complementarity),
        sharedInterests: row.shared_interests == null ? null : Number(row.shared_interests),
        eventRelevance: row.event_relevance == null ? null : Number(row.event_relevance),
        finalScore: Number(row.final_score),
        confidence: (row.confidence as RecommendationRecord["confidence"]) ?? "low",
        sharedGoalLabels: asStringArray(row.shared_goal_labels),
        sharedInterestLabels: asStringArray(row.shared_interest_labels),
        sharedSkillLabels: asStringArray(row.shared_skill_labels),
        complementLabels: asStringArray(row.complement_labels),
        rankingVersion: String(row.ranking_version),
        viewerHash: String(row.viewer_hash),
        candidateHash: String(row.candidate_hash),
        viewerContextHash: String(row.viewer_context_hash),
        candidateContextHash: String(row.candidate_context_hash),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }),
    ),
    explanations: (explanations.data ?? []).map(
      (row): CachedExplanation<GroundedExplanation> => ({
        id: String(row.id),
        cacheKey: String(row.cache_key),
        eventId: String(row.event_id),
        viewerId: String(row.viewer_id),
        candidateId: String(row.candidate_id),
        modelId: String(row.model_id),
        promptVersion: String(row.prompt_version),
        status: row.status as CachedExplanation<GroundedExplanation>["status"],
        value: (row.structured as GroundedExplanation | null) ?? null,
        inputFingerprint: String(row.input_fingerprint),
        tokenUsage:
          row.input_tokens != null || row.output_tokens != null
            ? {
                input: row.input_tokens == null ? null : Number(row.input_tokens),
                output: row.output_tokens == null ? null : Number(row.output_tokens),
              }
            : null,
        attempts: Number(row.attempts ?? 0),
        leaseUntil: row.lease_until ? String(row.lease_until) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        error: row.error ? String(row.error) : null,
      }),
    ),
    metrics: { ...emptyMetrics(), ...((metricsRow.data?.payload as Partial<EngineMetrics> | null) ?? {}) },
    affinity: [],
  });
}

async function replaceTable(
  admin: Admin,
  table: string,
  rows: Record<string, unknown>[],
  key: string | string[],
): Promise<void> {
  const existing = await admin.from(table).select(typeof key === "string" ? key : key.join(","));
  if (existing.error) throw new Error(existing.error.message);
  const nextKeys = new Set(
    rows.map((row) => (typeof key === "string" ? String(row[key]) : key.map((part) => String(row[part])).join("::"))),
  );
  const toDelete = (existing.data ?? [])
    .map((row) => {
      const record = row as Record<string, unknown>;
      return typeof key === "string" ? String(record[key]) : key.map((part) => String(record[part])).join("::");
    })
    .filter((item) => !nextKeys.has(item));

  if (rows.length > 0) {
    const upserted = await admin.from(table).upsert(rows);
    if (upserted.error) throw new Error(`${table}: ${upserted.error.message}`);
  }

  for (const item of toDelete) {
    let query = admin.from(table).delete();
    if (typeof key === "string") {
      query = query.eq(key, item);
    } else {
      const parts = item.split("::");
      key.forEach((part, index) => {
        query = query.eq(part, parts[index] ?? "");
      });
    }
    const deleted = await query;
    if (deleted.error) throw new Error(`${table} delete: ${deleted.error.message}`);
  }
}

async function persistSnapshot(admin: Admin, database: Database): Promise<void> {
  await admin.rpc("intromesh_advisory_lock");
  try {
    await replaceTable(
      admin,
      "events",
      database.events.map((event) => ({
        id: event.id,
        name: event.name,
        demo: event.demo,
        description: event.description,
        category: event.category,
        starts_at: event.startsAt,
        code: event.code,
        status: event.status,
        created_by: event.createdBy,
      })),
      "id",
    );

    await replaceTable(
      admin,
      "profiles",
      database.profiles.map((profile) => ({
        id: profile.id,
        slug: profile.slug,
        display_name: profile.displayName,
        role: profile.role,
        bio: profile.bio,
        interests: profile.interests,
        skills: profile.skills,
        projects: profile.projects,
        offers: profile.offers,
        seeking: profile.seeking,
        goal: profile.goal,
        demo: profile.demo,
        presentation: profile.presentation,
        created_at: profile.createdAt,
      })),
      "id",
    );

    const linkRows = database.profiles.flatMap((profile) =>
      profile.links.map((link) => ({
        profile_id: profile.id,
        label: link.label,
        url: link.url,
      })),
    );
    const clearedLinks = await admin.from("profile_links").delete().not("profile_id", "is", null);
    if (clearedLinks.error) throw new Error(clearedLinks.error.message);
    if (linkRows.length > 0) {
      const inserted = await admin.from("profile_links").insert(linkRows);
      if (inserted.error) throw new Error(inserted.error.message);
    }

    await replaceTable(
      admin,
      "presence",
      database.presence.map((item) => ({
        profile_id: item.profileId,
        event_id: item.eventId,
        status: item.status,
        source: item.source,
        updated_at: item.updatedAt,
        expires_at: item.expiresAt,
      })),
      ["profile_id", "event_id"],
    );

    await replaceTable(
      admin,
      "connections",
      database.connections.map((item) => ({
        id: item.id,
        event_id: item.eventId,
        from_id: item.fromId,
        to_id: item.toId,
        status: item.status,
        intro: item.intro,
        intro_source: item.introSource,
        created_at: item.createdAt,
        accepted_at: item.acceptedAt,
      })),
      "id",
    );

    await replaceTable(
      admin,
      "analytics_events",
      database.analytics.map((item) => ({
        id: item.id,
        event_id: item.eventId,
        type: item.type,
        topic: item.topic,
        at: item.at,
      })),
      "id",
    );

    await replaceTable(
      admin,
      "global_identities",
      database.identities.map((item) => ({
        user_id: item.userId,
        display_name: item.displayName,
        original_description: item.originalDescription,
        input_hash: item.inputHash,
        generated: item.generated,
        confirmed: item.confirmed,
        revision: item.revision,
        status: item.status,
        source: item.source,
        updated_at: item.updatedAt,
      })),
      "user_id",
    );

    await replaceTable(
      admin,
      "event_participations",
      database.participations.map((item) => ({
        user_id: item.userId,
        event_id: item.eventId,
        intent_text: item.intentText,
        looking_for: item.lookingFor,
        collaboration_interests: item.collaborationInterests,
        revision: item.revision,
        input_hash: item.inputHash,
        consent: item.consent,
        visibility: item.visibility,
        status: item.status,
        updated_at: item.updatedAt,
      })),
      ["user_id", "event_id"],
    );

    await replaceTable(
      admin,
      "profile_embeddings",
      database.embeddings
        .filter((item) => item.kind === "global")
        .map((item) => ({
          user_id: item.userId,
          embedding: toVectorValue(item.vector),
          model_id: item.modelId,
          model_revision: item.modelRevision,
          input_hash: item.inputHash,
          profile_revision: item.profileRevision,
          status: item.status,
          attempts: item.attempts,
          lease_until: item.leaseUntil,
          error: item.error,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
        })),
      "user_id",
    );

    await replaceTable(
      admin,
      "event_context_embeddings",
      database.embeddings
        .filter((item) => item.kind === "event" && item.eventId)
        .map((item) => ({
          user_id: item.userId,
          event_id: item.eventId,
          embedding: toVectorValue(item.vector),
          model_id: item.modelId,
          model_revision: item.modelRevision,
          input_hash: item.inputHash,
          profile_revision: item.profileRevision,
          status: item.status,
          attempts: item.attempts,
          lease_until: item.leaseUntil,
          error: item.error,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
        })),
      ["user_id", "event_id"],
    );

    await replaceTable(
      admin,
      "event_match_recommendations",
      database.recommendations.map((item) => ({
        event_id: item.eventId,
        viewer_id: item.viewerId,
        candidate_id: item.candidateId,
        identity_similarity: item.identitySimilarity,
        context_similarity: item.contextSimilarity,
        cosine_distance: item.cosineDistance,
        goal_compatibility: item.goalCompatibility,
        skill_complementarity: item.skillComplementarity,
        shared_interests: item.sharedInterests,
        event_relevance: item.eventRelevance,
        final_score: item.finalScore,
        confidence: item.confidence,
        shared_goal_labels: item.sharedGoalLabels,
        shared_interest_labels: item.sharedInterestLabels,
        shared_skill_labels: item.sharedSkillLabels,
        complement_labels: item.complementLabels,
        ranking_version: item.rankingVersion,
        viewer_hash: item.viewerHash,
        candidate_hash: item.candidateHash,
        viewer_context_hash: item.viewerContextHash,
        candidate_context_hash: item.candidateContextHash,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
      ["event_id", "viewer_id", "candidate_id"],
    );

    await replaceTable(
      admin,
      "match_explanations",
      database.explanations.map((item) => ({
        id: item.id,
        cache_key: item.cacheKey,
        event_id: item.eventId,
        viewer_id: item.viewerId,
        candidate_id: item.candidateId,
        model_id: item.modelId,
        prompt_version: item.promptVersion,
        status: item.status,
        match_reason: item.value?.matchReason ?? item.value?.summary ?? null,
        shared_signals: item.value?.sharedSignals ?? item.value?.citedInterests ?? null,
        complementary_signals: item.value?.complementarySignals ?? item.value?.complement ?? null,
        conversation_starter: item.value?.conversationStarter ?? item.value?.opener ?? null,
        confidence_notes: item.value?.confidenceNotes ?? null,
        structured: item.value,
        input_fingerprint: item.inputFingerprint,
        input_tokens: item.tokenUsage?.input ?? null,
        output_tokens: item.tokenUsage?.output ?? null,
        attempts: item.attempts,
        lease_until: item.leaseUntil,
        error: item.error,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
      "id",
    );

    const metrics = await admin.from("engine_metrics").upsert({
      id: 1,
      payload: database.metrics,
      updated_at: new Date().toISOString(),
    });
    if (metrics.error) throw new Error(metrics.error.message);
  } finally {
    await admin.rpc("intromesh_advisory_unlock");
  }
}

export function createSupabaseStore(): FileStore {
  let chain: Promise<unknown> = Promise.resolve();
  const admin = () => createSupabaseAdmin();

  async function read(): Promise<Database> {
    return loadSnapshot(admin());
  }

  function update<T>(mutator: (database: Database) => T | Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const client = admin();
      const database = await loadSnapshot(client);
      const result = await mutator(database);
      await persistSnapshot(client, database);
      return result;
    });
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    file: "supabase",
    read,
    update,
    refreshDemoPresence(now = Date.now()) {
      return update((database) => {
        for (const record of database.presence) {
          if (record.source !== "demo") continue;
          record.updatedAt = new Date(now).toISOString();
          record.expiresAt = new Date(now + 1000 * 60 * 60 * 6).toISOString();
        }
      });
    },
  };
}
