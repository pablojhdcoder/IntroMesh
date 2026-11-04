import { DEMO_EVENT_ID } from "@/domain/catalog";
import { buildDemoCommunity } from "@/domain/demo-community";
import type { CachedExplanation } from "@/domain/cache/explanations";
import type { EmbeddingRecord } from "@/domain/embedding/jobs";
import { emptyMetrics, type EngineMetrics } from "@/domain/engine-metrics";
import type { GroundedExplanation } from "@/domain/ground";
import type { StructuredIdentity } from "@/domain/identity/schema";
import type { StoredProfile } from "@/domain/profile";

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
  coverUrl?: string | null;
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
  joinedAt?: string;
  role?: string;
  lastActiveAt?: string | null;
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
  introSource: "model" | "user" | null;
  createdAt: string;
  acceptedAt: string | null;
};

export type AccountRecord = {
  userId: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type AffinityCacheRecord = {
  key: string;
  value: GroundedExplanation;
};

export type Database = {
  events: EventRecord[];
  profiles: StoredProfile[];
  connections: ConnectionRecord[];
  affinity: AffinityCacheRecord[];
  accounts: AccountRecord[];
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
    coverUrl: event.coverUrl ?? null,
  };
}

function demoEvent(): EventRecord {
  return asEvent({
    id: DEMO_EVENT_ID,
    name: "Meta Hackathon",
    demo: true,
    description: "Meta Global AI Developer Hackathon — build with Muse Spark, Muse Image and SAM 3.1.",
    category: "hackathon",
    code: "META-HACK",
    status: "live",
    startsAt: "2026-10-26T13:00:00.000Z",
    coverUrl: "/events/meta-hackathon-2026.svg",
  });
}

export const EXTRA_EVENTS: EventRecord[] = [
  asEvent({
    id: "junction-2026",
    name: "Junction 2026",
    demo: false,
    description: "Europe's largest hackathon: 48 hours in Espoo to build the next paradigm of technology.",
    category: "hackathon",
    startsAt: "2026-11-13T16:00:00.000Z",
    code: "JUNCTION-2026",
    status: "upcoming",
    createdBy: null,
    coverUrl: "/events/junction-2026.svg",
  }),
  asEvent({
    id: "nasa-space-apps-2026",
    name: "NASA Space Apps Challenge 2026",
    demo: false,
    description: "The largest annual global hackathon using NASA open data for Earth and space challenges.",
    category: "hackathon",
    startsAt: "2026-11-14T09:00:00.000Z",
    code: "SPACE-APPS-2026",
    status: "upcoming",
    createdBy: null,
    coverUrl: "/events/nasa-space-apps-2026.svg",
  }),
  asEvent({
    id: "earthcode-2026",
    name: "EarthCODE Hackathon 2026",
    demo: false,
    description: "Build open, reusable Earth observation workflows with ESA at ESRIN, Frascati.",
    category: "hackathon",
    startsAt: "2026-11-30T09:00:00.000Z",
    code: "EARTHCODE-2026",
    status: "upcoming",
    createdBy: null,
    coverUrl: "/events/earthcode-2026.svg",
  }),
  asEvent({
    id: "ethconf-2027",
    name: "ETHConf 2027",
    demo: false,
    description: "ETHGlobal flagship: builders shipping the decentralized future in New York City.",
    category: "hackathon",
    startsAt: "2027-06-14T09:00:00.000Z",
    code: "ETHCONF-2027",
    status: "upcoming",
    createdBy: null,
    coverUrl: "/events/ethconf-2027.svg",
  }),
  asEvent({
    id: "wfeo-hackathon-2027",
    name: "WFEO Hackathon 2027",
    demo: false,
    description: "Engineering students hack sustainable transport and cleaner mobility, online worldwide.",
    category: "hackathon",
    startsAt: "2027-11-20T09:00:00.000Z",
    code: "WFEO-2027",
    status: "upcoming",
    createdBy: null,
    coverUrl: "/events/wfeo-hackathon-2027.svg",
  }),
];

export function hydrateDatabase(input: Partial<Database> | null | undefined): Database {
  const seeded = input?.profiles ? null : buildDemoCommunity();
  const baseEvents = input?.events ?? [demoEvent(), ...EXTRA_EVENTS];
  const events = baseEvents.map((event) => asEvent(event));
  return {
    events,
    profiles: input?.profiles ?? seeded?.profiles ?? [],
    connections: input?.connections ?? [],
    affinity: input?.affinity ?? [],
    accounts: input?.accounts ?? [],
    identities: input?.identities ?? [],
    participations: (input?.participations ?? seeded?.participations ?? []).map((item) => ({
      ...item,
      lookingFor: item.lookingFor ?? [],
      collaborationInterests: item.collaborationInterests ?? [],
      joinedAt: item.joinedAt ?? item.updatedAt,
      role: item.role ?? "attendee",
      lastActiveAt: item.lastActiveAt ?? null,
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
