import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isPresenceLive, nextExpiry } from "@/domain/presence";
import { hydrateDatabase, type Database, type Store } from "./types";

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

/** Disk-backed store for tests. Production uses Supabase via `getStore()`. */
export function createMemoryStore(directory: string): Store {
  const file = path.join(directory, "store.json");
  const lockPath = path.join(directory, "store.lock");
  let chain: Promise<unknown> = Promise.resolve();

  function parseDatabase(raw: string): Database {
    return hydrateDatabase(JSON.parse(raw) as Partial<Database>);
  }

  async function recoverCorruptUnlocked(): Promise<Database> {
    const backup = `${file}.corrupt.${Date.now()}`;
    await rename(file, backup).catch(() => undefined);
    const initial = hydrateDatabase(null);
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
      const initial = hydrateDatabase(null);
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
