import "server-only";
import { createSupabaseStore } from "./supabase-store";
import type { Store } from "./types";

const globalStore = globalThis as typeof globalThis & {
  __intromeshStore?: Store;
  __intromeshPersistence?: "supabase";
};

function requireSupabaseEnv() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required. IntroMesh no longer uses .data/store.json.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required. IntroMesh no longer uses .data/store.json.");
  }
}

export function getStore(): Store {
  requireSupabaseEnv();
  globalStore.__intromeshStore ??= createSupabaseStore();
  globalStore.__intromeshPersistence = "supabase";
  return globalStore.__intromeshStore;
}

export function persistenceMode(): "supabase" {
  requireSupabaseEnv();
  return "supabase";
}

export type {
  AffinityCacheRecord,
  ConnectionRecord,
  Database,
  EventRecord,
  GlobalIdentityRecord,
  ParticipationRecord,
  RecommendationRecord,
  Store,
} from "./types";
export { hydrateDatabase } from "./types";
