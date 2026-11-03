import "server-only";
import { emptyMetrics, type EngineMetrics } from "@/domain/engine-metrics";
import type { AnalyticsRecord } from "@/domain/analytics";
import type { CachedExplanation } from "@/domain/cache/explanations";
import type { EmbeddingRecord } from "@/domain/embedding/jobs";
import type { GroundedExplanation } from "@/domain/ground";
import type { StructuredIdentity } from "@/domain/identity/schema";
import type { Presentation, StoredProfile } from "@/domain/profile";
import { nextExpiry, type PresenceRecord, type PresenceStatus } from "@/domain/presence";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  hydrateDatabase,
  type ConnectionRecord,
  type Database,
  type EventRecord,
  type GlobalIdentityRecord,
  type ParticipationRecord,
  type RecommendationRecord,
  type Store,
} from "./types";

type Admin = ReturnType<typeof createSupabaseAdmin>;

// Module singleton: one Supabase admin client per process (persistSession:false,
// autoRefreshToken:false), revalidated when env credentials change (tests, rotation).
// Previously every store.read()/update() built a fresh client per call.
let cachedAdmin: Admin | null = null;
let cachedAdminKey = "";

function getAdmin(): Admin {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const cacheKey = `${url}\n${key}`;
  if (!cachedAdmin || cachedAdminKey !== cacheKey) {
    cachedAdmin = createSupabaseAdmin();
    cachedAdminKey = cacheKey;
  }
  return cachedAdmin;
}

/**
 * Short-TTL snapshot cache with version invalidation. Page load fires
 * session → discovery → connections → affinity within milliseconds, and each
 * of those used to transfer the whole database (including every embedding
 * vector) again. Writes bump the version, so readers only ever skip loads
 * that cannot have changed in this process. External writers (SQL editor,
 * backfill script runs) are bounded by the TTL instead — 2.5 s of
 * staleness max on presence-grade data. Single-instance assumption: with
 * several server instances each keeps its own cache and TTL is the coherency
 * bound. Cloned on the way out: mutators own what they receive.
 */
const SNAPSHOT_TTL_MS = 2500;

let snapshotCache: { at: number; version: number; database: Database } | null = null;
let snapshotVersion = 0;

function invalidateSnapshot(): void {
  snapshotVersion += 1;
}

async function loadSnapshotCached(admin: Admin): Promise<Database> {
  const now = Date.now();
  const hit = snapshotCache;
  if (hit && hit.version === snapshotVersion && now - hit.at < SNAPSHOT_TTL_MS) {
    return structuredClone(hit.database);
  }
  const database = await loadSnapshot(admin);
  snapshotCache = { at: Date.now(), version: snapshotVersion, database: structuredClone(database) };
  return database;
}

// Explicit column lists replace select("*"). Same data the mappers consume, so no
// behavior change — except match_explanations, which drops derived text columns
// (match_reason, shared_signals, ...) that are rebuilt from `structured` on write
// and never read. Vectors stay: discovery scoring reads them (see light readers).
const EVENT_COLUMNS =
  "id,name,demo,description,category,starts_at,code,status,created_by";
const PROFILE_COLUMNS =
  "id,slug,display_name,role,bio,interests,skills,projects,offers,seeking,goal,demo,presentation,created_at,avatar_url,profile_visibility";
const LINK_COLUMNS = "profile_id,label,url";
const PRESENCE_COLUMNS = "profile_id,event_id,status,source,updated_at,expires_at";
const CONNECTION_COLUMNS = "id,event_id,from_id,to_id,status,intro,intro_source,created_at,accepted_at";
const ANALYTICS_COLUMNS = "id,event_id,type,topic,at";
const IDENTITY_COLUMNS =
  "user_id,display_name,original_description,input_hash,generated,confirmed,revision,status,source,updated_at";
const PARTICIPATION_COLUMNS =
  "user_id,event_id,intent_text,looking_for,collaboration_interests,revision,input_hash,consent,visibility,status,updated_at,joined_at,role,last_active_at";
const GLOBAL_EMBEDDING_COLUMNS =
  "user_id,embedding,model_id,model_revision,input_hash,profile_revision,status,attempts,lease_until,error,created_at,updated_at";
// Status-only variant for read paths: discovery/affinity need to know whether
// a global vector is ready, but must not transfer 1536-dim vectors per request.
const GLOBAL_EMBEDDING_STATUS_COLUMNS =
  "user_id,model_id,model_revision,input_hash,profile_revision,status,attempts,lease_until,error,created_at,updated_at";
const EVENT_EMBEDDING_COLUMNS =
  "user_id,event_id,embedding,model_id,model_revision,input_hash,profile_revision,status,attempts,lease_until,error,created_at,updated_at";
const RECOMMENDATION_COLUMNS =
  "event_id,viewer_id,candidate_id,identity_similarity,context_similarity,cosine_distance,goal_compatibility,skill_complementarity,shared_interests,event_relevance,final_score,confidence,shared_goal_labels,shared_interest_labels,shared_skill_labels,complement_labels,ranking_version,viewer_hash,candidate_hash,viewer_context_hash,candidate_context_hash,created_at,updated_at";
const EXPLANATION_COLUMNS =
  "id,cache_key,event_id,viewer_id,candidate_id,model_id,prompt_version,status,structured,input_fingerprint,input_tokens,output_tokens,attempts,lease_until,error,created_at,updated_at";

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

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
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    profileVisibility: row.profile_visibility === "private" ? "private" : "public",
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

function mapPresenceRow(row: Record<string, unknown>): PresenceRecord {
  return {
    profileId: String(row.profile_id),
    eventId: String(row.event_id),
    status: row.status as PresenceRecord["status"],
    source: row.source as PresenceRecord["source"],
    updatedAt: String(row.updated_at),
    expiresAt: String(row.expires_at),
  };
}

function mapConnectionRow(row: Record<string, unknown>): ConnectionRecord {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    fromId: String(row.from_id),
    toId: String(row.to_id),
    status: row.status as ConnectionRecord["status"],
    intro: row.intro ? String(row.intro) : null,
    introSource: (row.intro_source as ConnectionRecord["introSource"]) ?? null,
    createdAt: String(row.created_at),
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
  };
}

function mapAnalyticsRow(row: Record<string, unknown>): AnalyticsRecord {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    type: row.type as AnalyticsRecord["type"],
    topic: row.topic ? String(row.topic) : null,
    at: String(row.at),
  };
}

function mapIdentityRow(row: Record<string, unknown>): GlobalIdentityRecord {
  return {
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
  };
}

function mapParticipationRow(row: Record<string, unknown>): ParticipationRecord {
  return {
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
    joinedAt: row.joined_at ? String(row.joined_at) : String(row.updated_at),
    role: row.role ? String(row.role) : "attendee",
    lastActiveAt: row.last_active_at ? String(row.last_active_at) : null,
  };
}

function mapGlobalEmbeddingRow(row: Record<string, unknown>): EmbeddingRecord {
  return {
    id: `global:${row.user_id}:global`,
    kind: "global",
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
  };
}

function mapEventEmbeddingRow(row: Record<string, unknown>): EmbeddingRecord {
  return {
    id: `event:${row.user_id}:${row.event_id}`,
    kind: "event",
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
  };
}

function mapRecommendationRow(row: Record<string, unknown>): RecommendationRecord {
  return {
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
  };
}

function mapGlobalEmbeddingStatusRow(row: Record<string, unknown>): EmbeddingRecord {
  return {
    id: `global:${row.user_id}:global`,
    kind: "global",
    userId: String(row.user_id),
    eventId: null,
    vector: null,
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
  };
}

function mapExplanationRow(row: Record<string, unknown>): CachedExplanation<GroundedExplanation> {
  return {
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
  };
}

function throwOnErrors(errors: { message: string }[]): void {
  const active = errors.filter(Boolean);
  if (active.length > 0) {
    throw new Error(active.map((item) => item?.message).join("; "));
  }
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
    admin.from("events").select(EVENT_COLUMNS),
    admin.from("profiles").select(PROFILE_COLUMNS),
    admin.from("profile_links").select(LINK_COLUMNS),
    admin.from("presence").select(PRESENCE_COLUMNS),
    admin.from("connections").select(CONNECTION_COLUMNS),
    admin.from("analytics_events").select(ANALYTICS_COLUMNS),
    admin.from("global_identities").select(IDENTITY_COLUMNS),
    admin.from("event_participations").select(PARTICIPATION_COLUMNS),
    admin.from("profile_embeddings").select(GLOBAL_EMBEDDING_COLUMNS),
    admin.from("event_context_embeddings").select(EVENT_EMBEDDING_COLUMNS),
    admin.from("event_match_recommendations").select(RECOMMENDATION_COLUMNS),
    admin.from("match_explanations").select(EXPLANATION_COLUMNS),
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
  throwOnErrors(errors as { message: string }[]);

  const linksByProfile = new Map<string, { label: string; url: string }[]>();
  for (const row of links.data ?? []) {
    const profileId = String(row.profile_id);
    const list = linksByProfile.get(profileId) ?? [];
    list.push({ label: String(row.label), url: String(row.url) });
    linksByProfile.set(profileId, list);
  }

  const embeddings: EmbeddingRecord[] = [
    ...(globalEmbeddings.data ?? []).map((row) => mapGlobalEmbeddingRow(row as unknown as Record<string, unknown>)),
    ...(eventEmbeddings.data ?? []).map((row) =>
      mapEventEmbeddingRow(row as unknown as Record<string, unknown>),
    ),
  ];

  return hydrateDatabase({
    events: (events.data ?? []).map((row) => mapEvent(row as Record<string, unknown>)),
    profiles: (profiles.data ?? []).map((row) =>
      mapProfile(row as Record<string, unknown>, linksByProfile.get(String(row.id)) ?? []),
    ),
    presence: (presence.data ?? []).map((row) => mapPresenceRow(row as unknown as Record<string, unknown>)),
    connections: (connections.data ?? []).map((row) => mapConnectionRow(row as unknown as Record<string, unknown>)),
    analytics: (analytics.data ?? []).map((row) => mapAnalyticsRow(row as unknown as Record<string, unknown>)),
    identities: (identities.data ?? []).map((row) => mapIdentityRow(row as unknown as Record<string, unknown>)),
    participations: (participations.data ?? []).map((row) =>
      mapParticipationRow(row as unknown as Record<string, unknown>),
    ),
    embeddings,
    recommendations: (recommendations.data ?? []).map((row) =>
      mapRecommendationRow(row as unknown as Record<string, unknown>),
    ),
    explanations: (explanations.data ?? []).map((row) =>
      mapExplanationRow(row as unknown as Record<string, unknown>),
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
      const record = row as unknown as Record<string, unknown>;
      return typeof key === "string" ? String(record[key]) : key.map((part) => String(record[part])).join("::");
    })
    .filter((item) => !nextKeys.has(item));

  if (rows.length > 0) {
    const upserted = await admin.from(table).upsert(rows);
    if (upserted.error) throw new Error(`${table}: ${upserted.error.message}`);
  }

  if (toDelete.length === 0) return;
  if (typeof key === "string") {
    // One round-trip instead of one DELETE per missing row.
    const deleted = await admin.from(table).delete().in(key, toDelete);
    if (deleted.error) throw new Error(`${table} delete: ${deleted.error.message}`);
    return;
  }
  for (const item of toDelete) {
    let query = admin.from(table).delete();
    const parts = item.split("::");
    key.forEach((part, index) => {
      query = query.eq(part, parts[index] ?? "");
    });
    const deleted = await query;
    if (deleted.error) throw new Error(`${table} delete: ${deleted.error.message}`);
  }
}

type PersistedCollection =
  | "events"
  | "profiles"
  | "presence"
  | "connections"
  | "analytics"
  | "identities"
  | "participations"
  | "embeddings"
  | "recommendations"
  | "explanations"
  | "metrics";

function snapshotSignatures(database: Database): Record<PersistedCollection, string> {
  return {
    events: JSON.stringify(database.events),
    profiles: JSON.stringify(database.profiles),
    presence: JSON.stringify(database.presence),
    connections: JSON.stringify(database.connections),
    analytics: JSON.stringify(database.analytics),
    identities: JSON.stringify(database.identities),
    participations: JSON.stringify(database.participations),
    embeddings: JSON.stringify(database.embeddings),
    recommendations: JSON.stringify(database.recommendations),
    explanations: JSON.stringify(database.explanations),
    metrics: JSON.stringify(database.metrics),
  };
}

function dirtyCollections(
  before: Record<PersistedCollection, string>,
  database: Database,
): Set<PersistedCollection> {
  const after = snapshotSignatures(database);
  const dirty = new Set<PersistedCollection>();
  (Object.keys(before) as PersistedCollection[]).forEach((key) => {
    if (before[key] !== after[key]) dirty.add(key);
  });
  return dirty;
}

async function persistSnapshot(admin: Admin, database: Database, dirty?: Set<PersistedCollection>): Promise<void> {
  const isDirty = (key: PersistedCollection): boolean => !dirty || dirty.has(key);
  // Read-only update() calls (unknown profile, cache "wait"/"hit" polls) persist nothing.
  if (dirty && dirty.size === 0) return;
  await admin.rpc("intromesh_advisory_lock");
  try {
    // FK chain stays sequential: profile_links references profiles.
    if (isDirty("events")) {
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
    }

    if (isDirty("profiles")) {
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
          avatar_url: profile.avatarUrl ?? null,
          profile_visibility: profile.profileVisibility ?? "public",
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
    }

    // Independent tables persist concurrently on the shared stateless client.
    const pending: Promise<void>[] = [];
    const schedule = (key: PersistedCollection, write: () => Promise<void>): void => {
      if (isDirty(key)) pending.push(write());
    };

    schedule("presence", () =>
      replaceTable(
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
      ),
    );

    schedule("connections", () =>
      replaceTable(
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
      ),
    );

    schedule("analytics", () =>
      replaceTable(
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
      ),
    );

    schedule("identities", () =>
      replaceTable(
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
      ),
    );

    schedule("participations", () =>
      replaceTable(
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
          joined_at: item.joinedAt ?? item.updatedAt,
          role: item.role ?? "attendee",
          last_active_at: item.lastActiveAt ?? null,
        })),
        ["user_id", "event_id"],
      ),
    );

    schedule("embeddings", () =>
      replaceTable(
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
      ),
    );

    schedule("embeddings", () =>
      replaceTable(
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
      ),
    );

    schedule("recommendations", () =>
      replaceTable(
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
      ),
    );

    schedule("explanations", () =>
      replaceTable(
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
      ),
    );

    if (isDirty("metrics")) {
      pending.push(
        (async () => {
          const metrics = await admin.from("engine_metrics").upsert({
            id: 1,
            payload: database.metrics,
            updated_at: new Date().toISOString(),
          });
          if (metrics.error) throw new Error(metrics.error.message);
        })(),
      );
    }

    const settled = await Promise.allSettled(pending);
    for (const item of settled) {
      if (item.status === "rejected") throw item.reason;
    }
  } finally {
    await admin.rpc("intromesh_advisory_unlock");
  }
}

function emptyRows() {
  return Promise.resolve({ data: [] as Record<string, unknown>[], error: null });
}

/** Scoped read-only loaders for hot read paths. They return a full Database shape
 * (unused collections stay empty via hydrateDatabase) so action logic is unchanged,
 * but skip the heavy tables entirely: no embedding vectors, no explanation
 * structured payloads, no analytics history, no full-table scans.
 * Update() paths keep the full snapshot: partial snapshots must never be persisted.
 */
async function readSessionSnapshot(profileId: string | null): Promise<Database> {
  const admin = getAdmin();
  const scoped = Boolean(profileId && SAFE_ID.test(profileId));
  const [events, profiles, links, identities, participations, presence] = await Promise.all([
    admin.from("events").select(EVENT_COLUMNS),
    scoped ? admin.from("profiles").select(PROFILE_COLUMNS).eq("id", profileId).limit(1) : emptyRows(),
    scoped ? admin.from("profile_links").select(LINK_COLUMNS).eq("profile_id", profileId) : emptyRows(),
    scoped ? admin.from("global_identities").select(IDENTITY_COLUMNS).eq("user_id", profileId) : emptyRows(),
    scoped ? admin.from("event_participations").select(PARTICIPATION_COLUMNS).eq("user_id", profileId) : emptyRows(),
    scoped ? admin.from("presence").select(PRESENCE_COLUMNS).eq("profile_id", profileId) : emptyRows(),
  ]);
  throwOnErrors(
    [events.error, profiles.error, links.error, identities.error, participations.error, presence.error].filter(
      Boolean,
    ) as { message: string }[],
  );
  const linksByProfile = new Map<string, { label: string; url: string }[]>();
  for (const row of (links.data ?? []) as Record<string, unknown>[]) {
    const list = linksByProfile.get(String(row.profile_id)) ?? [];
    list.push({ label: String(row.label), url: String(row.url) });
    linksByProfile.set(String(row.profile_id), list);
  }
  return hydrateDatabase({
    events: ((events.data ?? []) as Record<string, unknown>[]).map(mapEvent),
    profiles: ((profiles.data ?? []) as Record<string, unknown>[]).map((row) =>
      mapProfile(row, linksByProfile.get(String(row.id)) ?? []),
    ),
    presence: ((presence.data ?? []) as Record<string, unknown>[]).map(mapPresenceRow),
    identities: ((identities.data ?? []) as Record<string, unknown>[]).map(mapIdentityRow),
    participations: ((participations.data ?? []) as Record<string, unknown>[]).map(mapParticipationRow),
  });
}

async function readProfileCardSnapshot(slug: string): Promise<Database> {
  const admin = getAdmin();
  const scoped = SAFE_ID.test(slug);
  const profileRes = scoped
    ? await admin.from("profiles").select(PROFILE_COLUMNS).eq("slug", slug).limit(1)
    : { data: [] as Record<string, unknown>[], error: null };
  if (profileRes.error) throw new Error(profileRes.error.message);
  const rows = (profileRes.data ?? []) as Record<string, unknown>[];
  const profileId = rows.length > 0 ? String(rows[0].id) : null;
  const linksRes =
    profileId && SAFE_ID.test(profileId)
      ? await admin.from("profile_links").select(LINK_COLUMNS).eq("profile_id", profileId)
      : { data: [] as Record<string, unknown>[], error: null };
  if (linksRes.error) throw new Error(linksRes.error.message);
  const links = ((linksRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
    label: String(row.label),
    url: String(row.url),
  }));
  return hydrateDatabase({
    profiles: rows.map((row) => mapProfile(row, profileId && String(row.id) === profileId ? links : [])),
  });
}

async function readConnectionsSnapshot(profileId: string, eventId: string): Promise<Database> {
  const admin = getAdmin();
  const scoped = SAFE_ID.test(profileId) && SAFE_ID.test(eventId);
  const connectionsQuery = scoped
    ? admin
        .from("connections")
        .select(CONNECTION_COLUMNS)
        .eq("event_id", eventId)
        .or(`from_id.eq.${profileId},to_id.eq.${profileId}`)
    : admin.from("connections").select(CONNECTION_COLUMNS).eq("event_id", eventId);
  const connectionsRes = await connectionsQuery;
  if (connectionsRes.error) throw new Error(connectionsRes.error.message);
  let rows = (connectionsRes.data ?? []) as Record<string, unknown>[];
  if (!scoped) {
    rows = rows.filter((row) => String(row.from_id) === profileId || String(row.to_id) === profileId);
  }
  const connections = rows.map(mapConnectionRow);
  const otherIds = [...new Set(connections.map((item) => (item.fromId === profileId ? item.toId : item.fromId)))].filter(
    (id) => SAFE_ID.test(id),
  );
  const [profilesRes, linksRes] =
    otherIds.length > 0
      ? await Promise.all([
          admin.from("profiles").select(PROFILE_COLUMNS).in("id", otherIds),
          admin.from("profile_links").select(LINK_COLUMNS).in("profile_id", otherIds),
        ])
      : [
          { data: [] as Record<string, unknown>[], error: null },
          { data: [] as Record<string, unknown>[], error: null },
        ];
  throwOnErrors([profilesRes.error, linksRes.error].filter(Boolean) as { message: string }[]);
  const linksByProfile = new Map<string, { label: string; url: string }[]>();
  for (const row of (linksRes.data ?? []) as Record<string, unknown>[]) {
    const list = linksByProfile.get(String(row.profile_id)) ?? [];
    list.push({ label: String(row.label), url: String(row.url) });
    linksByProfile.set(String(row.profile_id), list);
  }
  return hydrateDatabase({
    connections,
    profiles: ((profilesRes.data ?? []) as Record<string, unknown>[]).map((row) =>
      mapProfile(row, linksByProfile.get(String(row.id)) ?? []),
    ),
  });
}

/**
 * Discovery read path: one event, its live presence, the viewer's persisted
 * top-8, profiles by id, and the viewer's embedding readiness (status only,
 * never the vector). No scoring inputs beyond the stored rows.
 */
async function readDiscoverySnapshot(profileId: string, eventId: string): Promise<Database> {
  const admin = getAdmin();
  if (!SAFE_ID.test(profileId) || !SAFE_ID.test(eventId)) return loadSnapshot(admin);
  const [eventRes, presenceRes, recommendationsRes, embeddingRes] = await Promise.all([
    admin.from("events").select(EVENT_COLUMNS).eq("id", eventId).limit(1),
    admin.from("presence").select(PRESENCE_COLUMNS).eq("event_id", eventId),
    admin
      .from("event_match_recommendations")
      .select(RECOMMENDATION_COLUMNS)
      .eq("event_id", eventId)
      .eq("viewer_id", profileId)
      .order("final_score", { ascending: false })
      .limit(8),
    admin.from("profile_embeddings").select(GLOBAL_EMBEDDING_STATUS_COLUMNS).eq("user_id", profileId).limit(1),
  ]);
  throwOnErrors(
    [eventRes.error, presenceRes.error, recommendationsRes.error, embeddingRes.error].filter(Boolean) as {
      message: string;
    }[],
  );
  const recommendations = ((recommendationsRes.data ?? []) as Record<string, unknown>[]).map(mapRecommendationRow);
  const liveIds = new Set<string>([profileId]);
  for (const row of (presenceRes.data ?? []) as Record<string, unknown>[]) {
    liveIds.add(String(row.profile_id));
  }
  for (const row of recommendations) liveIds.add(row.candidateId);
  const ids = [...liveIds].slice(0, 500);
  const [profilesRes, linksRes] = await Promise.all([
    admin.from("profiles").select(PROFILE_COLUMNS).in("id", ids),
    admin.from("profile_links").select(LINK_COLUMNS).in("profile_id", ids),
  ]);
  throwOnErrors([profilesRes.error, linksRes.error].filter(Boolean) as { message: string }[]);
  const linksByProfile = new Map<string, { label: string; url: string }[]>();
  for (const row of (linksRes.data ?? []) as Record<string, unknown>[]) {
    const list = linksByProfile.get(String(row.profile_id)) ?? [];
    list.push({ label: String(row.label), url: String(row.url) });
    linksByProfile.set(String(row.profile_id), list);
  }
  return hydrateDatabase({
    events: ((eventRes.data ?? []) as Record<string, unknown>[]).map(mapEvent),
    profiles: ((profilesRes.data ?? []) as Record<string, unknown>[]).map((row) =>
      mapProfile(row, linksByProfile.get(String(row.id)) ?? []),
    ),
    presence: ((presenceRes.data ?? []) as Record<string, unknown>[]).map(mapPresenceRow),
    recommendations,
    embeddings: ((embeddingRes.data ?? []) as Record<string, unknown>[]).map(mapGlobalEmbeddingStatusRow),
  });
}

/**
 * Affinity read path: both profiles, live presence in the event, the
 * persisted viewer/candidate row, both identities and participations, and
 * prior explanations for the triple. No vectors, no analytics.
 */
async function readAffinitySnapshot(profileId: string, otherId: string, eventId: string): Promise<Database> {
  const admin = getAdmin();
  if (!SAFE_ID.test(profileId) || !SAFE_ID.test(otherId) || !SAFE_ID.test(eventId)) {
    return loadSnapshot(admin);
  }
  const ids = [profileId, otherId];
  const [profilesRes, linksRes, presenceRes, recommendationsRes, identitiesRes, participationsRes, explanationsRes] =
    await Promise.all([
      admin.from("profiles").select(PROFILE_COLUMNS).in("id", ids),
      admin.from("profile_links").select(LINK_COLUMNS).in("profile_id", ids),
      admin.from("presence").select(PRESENCE_COLUMNS).eq("event_id", eventId).in("profile_id", ids),
      admin
        .from("event_match_recommendations")
        .select(RECOMMENDATION_COLUMNS)
        .eq("event_id", eventId)
        .eq("viewer_id", profileId)
        .eq("candidate_id", otherId)
        .limit(1),
      admin.from("global_identities").select(IDENTITY_COLUMNS).in("user_id", ids),
      admin
        .from("event_participations")
        .select(PARTICIPATION_COLUMNS)
        .eq("event_id", eventId)
        .in("user_id", ids),
      admin
        .from("match_explanations")
        .select(EXPLANATION_COLUMNS)
        .eq("event_id", eventId)
        .eq("viewer_id", profileId)
        .eq("candidate_id", otherId),
    ]);
  throwOnErrors(
    [
      profilesRes.error,
      linksRes.error,
      presenceRes.error,
      recommendationsRes.error,
      identitiesRes.error,
      participationsRes.error,
      explanationsRes.error,
    ].filter(Boolean) as { message: string }[],
  );
  const linksByProfile = new Map<string, { label: string; url: string }[]>();
  for (const row of (linksRes.data ?? []) as Record<string, unknown>[]) {
    const list = linksByProfile.get(String(row.profile_id)) ?? [];
    list.push({ label: String(row.label), url: String(row.url) });
    linksByProfile.set(String(row.profile_id), list);
  }
  return hydrateDatabase({
    profiles: ((profilesRes.data ?? []) as Record<string, unknown>[]).map((row) =>
      mapProfile(row, linksByProfile.get(String(row.id)) ?? []),
    ),
    presence: ((presenceRes.data ?? []) as Record<string, unknown>[]).map(mapPresenceRow),
    recommendations: ((recommendationsRes.data ?? []) as Record<string, unknown>[]).map(mapRecommendationRow),
    identities: ((identitiesRes.data ?? []) as Record<string, unknown>[]).map(mapIdentityRow),
    participations: ((participationsRes.data ?? []) as Record<string, unknown>[]).map(mapParticipationRow),
    explanations: ((explanationsRes.data ?? []) as Record<string, unknown>[]).map(mapExplanationRow),
  });
}

/** Scoped read-only loaders exposed alongside the Store (structural, optional). */
export type SupabaseFastReads = {
  readSessionSnapshot: (profileId: string | null) => Promise<Database>;
  readProfileCardSnapshot: (slug: string) => Promise<Database>;
  readConnectionsSnapshot: (profileId: string, eventId: string) => Promise<Database>;
  readDiscoverySnapshot: (profileId: string, eventId: string) => Promise<Database>;
  readAffinitySnapshot: (profileId: string, otherId: string, eventId: string) => Promise<Database>;
};

/** Scoped write exposed alongside the Store (structural, optional). */
export type SupabaseFastWrites = {
  touchPresence: (
    profileId: string,
    eventId: string,
  ) => Promise<{ status: PresenceStatus } | { error: "profile" }>;
};

export function createSupabaseStore(): Store & SupabaseFastReads & SupabaseFastWrites {
  let chain: Promise<unknown> = Promise.resolve();

  async function read(): Promise<Database> {
    return loadSnapshotCached(getAdmin());
  }

  function update<T>(mutator: (database: Database) => T | Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const client = getAdmin();
      const database = await loadSnapshotCached(client);
      const before = snapshotSignatures(database);
      const result = await mutator(database);
      const dirty = dirtyCollections(before, database);
      // Zero-write updates (steady discovery, affinity hits) keep the cache:
      // nothing changed, so the next reader in the burst still hits it.
      if (dirty.size > 0) {
        try {
          await persistSnapshot(client, database, dirty);
        } finally {
          invalidateSnapshot();
        }
      }
      return result;
    });
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * Heartbeat-sized presence write: one profile check plus scoped row writes,
   * serialized on the same chain but with no 13-table snapshot, no full
   * persist and no vector payloads. The 20s keepalive used to cost a full
   * loadSnapshot+persistSnapshot each tick and queue everything behind it.
   */
  function touchPresence(
    profileId: string,
    eventId: string,
  ): Promise<{ status: PresenceStatus } | { error: "profile" }> {
    const run = chain.then(async () => {
      if (!SAFE_ID.test(profileId) || !SAFE_ID.test(eventId)) return { error: "profile" as const };
      const admin = getAdmin();
      const now = Date.now();
      const profileRes = await admin.from("profiles").select("id,demo").eq("id", profileId).limit(1);
      if (profileRes.error) throw new Error(profileRes.error.message);
      const row = (profileRes.data ?? [])[0] as { id?: unknown; demo?: unknown } | undefined;
      if (!row || row.demo) return { error: "profile" as const };
      // No advisory lock: every statement below is a single atomic row write,
      // so there is nothing to hold across calls. A concurrent full persist
      // may overwrite these timestamps with a seconds-old snapshot; the next
      // 20s keepalive repairs it.
      try {
        const status: PresenceStatus = "active";
        // Heartbeat is presence-only: verify joined membership, never mutate
        // it. Join/leave own consent and visibility. A left event stays left.
        const membership = await admin
          .from("event_participations")
          .select("user_id")
          .eq("user_id", profileId)
          .eq("event_id", eventId)
          .eq("status", "joined")
          .limit(1);
        if (membership.error) throw new Error(membership.error.message);
        if ((membership.data ?? []).length === 0) return { error: "profile" as const };
        const upserted = await admin.from("presence").upsert({
          profile_id: profileId,
          event_id: eventId,
          status,
          source: "session",
          updated_at: new Date(now).toISOString(),
          expires_at: nextExpiry(now),
        });
        if (upserted.error) throw new Error(upserted.error.message);
        return { status };
      } finally {
        invalidateSnapshot();
      }
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
    touchPresence,
    readSessionSnapshot,
    readProfileCardSnapshot,
    readConnectionsSnapshot,
    readDiscoverySnapshot,
    readAffinitySnapshot,
  };
}
