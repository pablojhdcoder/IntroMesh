import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_EVENT_ID } from "@/domain/catalog";
import { buildDemoCommunity } from "@/domain/demo-community";
import type { AnalyticsRecord } from "@/domain/analytics";
import type { GroundedExplanation } from "@/domain/ground";
import type { StoredProfile } from "@/domain/profile";
import { isPresenceLive, nextExpiry, type PresenceRecord } from "@/domain/presence";

export type EventRecord = {
  id: string;
  name: string;
  demo: boolean;
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
};

function emptyDatabase(): Database {
  const seeded = buildDemoCommunity();
  return {
    events: [{ id: DEMO_EVENT_ID, name: "Meta Hackathon", demo: true }],
    profiles: seeded.profiles,
    presence: seeded.presence,
    connections: [],
    analytics: seeded.analytics,
    affinity: [],
  };
}

export function createFileStore(directory: string) {
  const file = path.join(directory, "store.json");
  let chain: Promise<unknown> = Promise.resolve();

  async function read(): Promise<Database> {
    try {
      const raw = await readFile(file, "utf8");
      return JSON.parse(raw) as Database;
    } catch {
      const initial = emptyDatabase();
      await mkdir(directory, { recursive: true });
      await writeFile(file, JSON.stringify(initial));
      return initial;
    }
  }

  async function write(database: Database): Promise<void> {
    await mkdir(directory, { recursive: true });
    await writeFile(file, JSON.stringify(database));
  }

  function update<T>(mutator: (database: Database) => T | Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const database = await read();
      const result = await mutator(database);
      await write(database);
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
