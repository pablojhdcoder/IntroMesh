import { z } from "zod";

const supabaseEnvSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
  serviceRoleKey: z.string().min(1).optional(),
});

export function readSupabaseEnv(env: NodeJS.ProcessEnv = process.env) {
  return supabaseEnvSchema.parse({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  });
}
