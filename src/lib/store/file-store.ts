import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_EVENT_ID } from "@/domain/catalog";
import { buildDemoCommunity } from "@/domain/demo-community";
import type { AnalyticsRecord } from "@/domain/analytics";
import type { CachedExplanation } from "@/domain/cache/explanations";
import type { EmbeddingRecord } from "@/domain/embedding/jobs";
import { emptyMetrics, type EngineMetrics } from "@/domain/engine-metrics";
import type { GroundedExplanation } from "@/domain/ground";
import type { StructuredIdentity } from "@/domain/identity/schema";
import type { StoredProfile } from "@/domain/profile";
import { isPresenceLive, nextExpiry, type PresenceRecord } from "@/domain/presence";

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

function emptyDatabase(): Database {
  return hydrateDatabase(null);
}

const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 25;
const LOCK_ATTEMPTS = 200;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withFileLock(lockPath: string, run: () => Promise<void>): Promise<void> {
  await mkdir(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      try {
        await handle.writeFile(String(Date.now()), "utf8");
        await run();
      } finally {
        await handle.close().catch(() => undefined);
        await unlink(lockPath).catch(() => undefined);
      }
      return;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "EEXIST") throw error;
      try {
        const raw = await readFile(lockPath, "utf8");
        const stamped = Number(raw);
        if (Number.isFinite(stamped) && Date.now() - stamped > LOCK_STALE_MS) {
          await unlink(lockPath).catch(() => undefined);
          continue;
        }
      } catch {
        // Lock disappeared between races; retry.
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
  throw new Error("store lock timeout");
}

async function atomicWrite(file: string, contents: string): Promise<void> {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, contents, "utf8");
  try {
    await rename(temp, file);
  } catch {
    await unlink(file).catch(() => undefined);
    await rename(temp, file);
  }
}

export function createFileStore(directory: string) {
  const file = path.join(directory, "store.json");
  const lockPath = path.join(directory, "store.lock");
  let chain: Promise<unknown> = Promise.resolve();

  function parseDatabase(raw: string): Database {
    return hydrateDatabase(JSON.parse(raw) as Partial<Database>);
  }

  async function recoverCorruptUnlocked(): Promise<Database> {
    const backup = `${file}.corrupt.${Date.now()}`;
    await rename(file, backup).catch(() => undefined);
    const initial = emptyDatabase();
    await mkdir(directory, { recursive: true });
    await atomicWrite(file, JSON.stringify(initial));
    return initial;
  }

  async function ensureDatabaseUnlocked(): Promise<Database> {
    try {
      const raw = await readFile(file, "utf8");
      try {
        return parseDatabase(raw);
      } catch {
        return recoverCorruptUnlocked();
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "ENOENT") throw error;
      const initial = emptyDatabase();
      await mkdir(directory, { recursive: true });
      await atomicWrite(file, JSON.stringify(initial));
      return initial;
    }
  }

  async function read(): Promise<Database> {
    try {
      return parseDatabase(await readFile(file, "utf8"));
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "ENOENT" || error instanceof SyntaxError) {
        let snapshot!: Database;
        await withFileLock(lockPath, async () => {
          snapshot = await ensureDatabaseUnlocked();
        });
        return snapshot;
      }
      throw error;
    }
  }

  function update<T>(mutator: (database: Database) => T | Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      let result!: T;
      await withFileLock(lockPath, async () => {
        const database = await ensureDatabaseUnlocked();
        result = await mutator(database);
        await mkdir(directory, { recursive: true });
        await atomicWrite(file, JSON.stringify(database));
      });
      return result;
    });
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    file,
    read,
    update,
    refreshDemoPresence(now = Date.now()) {
      return update((database) => {
        for (const record of database.presence) {
          if (record.source !== "demo") continue;
          record.updatedAt = new Date(now).toISOString();
          record.expiresAt = nextExpiry(now, 1000 * 60 * 60 * 6);
        }
        database.presence = database.presence.filter(
          (record) => record.source === "demo" || isPresenceLive(record, now),
        );
      });
    },
  };
}

export type FileStore = ReturnType<typeof createFileStore>;
