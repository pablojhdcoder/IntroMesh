import { DEMO_EVENT_ID } from "@/domain/catalog";
import { buildDemoCommunity } from "@/domain/demo-community";
import type { AnalyticsRecord } from "@/domain/analytics";
import type { CachedExplanation } from "@/domain/cache/explanations";
import type { EmbeddingRecord } from "@/domain/embedding/jobs";
import { emptyMetrics, type EngineMetrics } from "@/domain/engine-metrics";
import type { GroundedExplanation } from "@/domain/ground";
import type { StructuredIdentity } from "@/domain/identity/schema";
import type { StoredProfile } from "@/domain/profile";
import type { PresenceRecord } from "@/domain/presence";

export type EventRecord = {
  id: string;
  name: string;
  demo: boolean;
  description: string;
  category: string;
  startsAt: string | null;
  code: string;
  status: "upcoming" | "live" | "ended";
  createdBy: string | null;
};

export type GlobalIdentityRecord = {
  userId: string;
  displayName: string;
  originalDescription: string;
  inputHash: string;
  generated: StructuredIdentity | null;
  confirmed: StructuredIdentity | null;
  revision: number;
  status: "draft" | "generated" | "confirmed";
  source: "model" | "user" | null;
  updatedAt: string;
};

export type ParticipationRecord = {
  userId: string;
  eventId: string;
  intentText: string;
  lookingFor: string[];
  collaborationInterests: string[];
  revision: number;
  inputHash: string;
  consent: boolean;
  visibility: "discoverable" | "hidden";
  status: "joined" | "left";
  updatedAt: string;
};

export type RecommendationRecord = {
  eventId: string;
  viewerId: string;
  candidateId: string;
  identitySimilarity: number | null;
  contextSimilarity: number | null;
  cosineDistance: number | null;
  goalCompatibility: number | null;
  skillComplementarity: number | null;
  sharedInterests: number | null;
  eventRelevance: number | null;
  finalScore: number;
  confidence: "low" | "medium" | "high";
  sharedGoalLabels: string[];
  sharedInterestLabels: string[];
  sharedSkillLabels: string[];
  complementLabels: string[];
  rankingVersion: string;
  viewerHash: string;
  candidateHash: string;
  viewerContextHash: string;
  candidateContextHash: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionRecord = {
  id: string;
  eventId: string;
  fromId: string;
  toId: string;
  status: "pending" | "accepted" | "declined";
  intro: string | null;
  introSource: "model" | "demo" | "user" | null;
  createdAt: string;
  acceptedAt: string | null;
};

export type AffinityCacheRecord = {
  key: string;
  value: GroundedExplanation;
};

export type Database = {
  events: EventRecord[];
  profiles: StoredProfile[];
  presence: PresenceRecord[];
  connections: ConnectionRecord[];
  analytics: AnalyticsRecord[];
  affinity: AffinityCacheRecord[];
  identities: GlobalIdentityRecord[];
  participations: ParticipationRecord[];
  embeddings: EmbeddingRecord[];
  recommendations: RecommendationRecord[];
  explanations: CachedExplanation<GroundedExplanation>[];
  metrics: EngineMetrics;
};

export type Store = {
  file: string;
  read: () => Promise<Database>;
  update: <T>(mutator: (database: Database) => T | Promise<T>) => Promise<T>;
  refreshDemoPresence: (now?: number) => Promise<void>;
};

function asEvent(event: Partial<EventRecord> & { id: string; name: string }): EventRecord {
  const code = event.id === DEMO_EVENT_ID && (!event.code || event.code === event.id) ? "META-HACK" : (event.code ?? event.id);
  return {
    id: event.id,
    name: event.name,
    demo: Boolean(event.demo),
    description: event.description ?? "",
    category: event.category ?? "",
    startsAt: event.startsAt ?? null,
    code,
    status: event.status ?? "live",
    createdBy: event.createdBy ?? null,
  };
}

function demoEvent(): EventRecord {
  return asEvent({
    id: DEMO_EVENT_ID,
    name: "Meta Hackathon",
    demo: true,
    description: "Demo fixture.",
    category: "hackathon",
    code: "META-HACK",
    status: "live",
  });
}

export function hydrateDatabase(input: Partial<Database> | null | undefined): Database {
  const seeded = input?.profiles ? null : buildDemoCommunity();
  const events = (input?.events ?? [demoEvent()]).map((event) => asEvent(event));
  return {
    events,
    profiles: input?.profiles ?? seeded?.profiles ?? [],
    presence: input?.presence ?? seeded?.presence ?? [],
    connections: input?.connections ?? [],
    analytics: input?.analytics ?? seeded?.analytics ?? [],
    affinity: input?.affinity ?? [],
    identities: input?.identities ?? [],
    participations: (input?.participations ?? []).map((item) => ({
      ...item,
      lookingFor: item.lookingFor ?? [],
      collaborationInterests: item.collaborationInterests ?? [],
    })),
    embeddings: input?.embeddings ?? [],
    recommendations: (input?.recommendations ?? []).map((item) => ({
      ...item,
      eventRelevance: item.eventRelevance ?? null,
      confidence: item.confidence ?? "low",
      sharedGoalLabels: item.sharedGoalLabels ?? [],
      sharedInterestLabels: item.sharedInterestLabels ?? [],
      sharedSkillLabels: item.sharedSkillLabels ?? [],
      complementLabels: item.complementLabels ?? [],
    })),
    explanations: input?.explanations ?? [],
    metrics: { ...emptyMetrics(), ...input?.metrics },
  };
}
