import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "./env";

export function createSupabaseAdmin(env: NodeJS.ProcessEnv = process.env) {
  const config = readSupabaseEnv(env);
  if (!config.serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
