import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(".env.local"));
loadEnvFile(resolve(".env"));

const expectedIds = Array.from({ length: 28 }, (_, index) => `demo-${String(index + 1).padStart(3, "0")}`);
const expectedAnalytics = 57;

function envPresent(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  console.log("env NEXT_PUBLIC_SUPABASE_URL", envPresent("NEXT_PUBLIC_SUPABASE_URL") ? "ok" : "missing");
  console.log("env NEXT_PUBLIC_SUPABASE_ANON_KEY", envPresent("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "ok" : "missing");
  console.log("env SUPABASE_SERVICE_ROLE_KEY", envPresent("SUPABASE_SERVICE_ROLE_KEY") ? "ok" : "missing");

  if (!url || (!service && !anon)) {
    console.log("RESULT cannot-query");
    process.exit(2);
  }

  const client = createClient(url, service || anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const role = service ? "service" : "anon";
  console.log("query role", role);

  const [events, profiles, presence, analytics, affinity] = await Promise.all([
    client.from("events").select("id, name, demo").eq("id", "meta-hackathon-2026"),
    client.from("profiles").select("id, display_name, demo, goal, slug").in("id", expectedIds),
    client.from("presence").select("profile_id, event_id, status, source, expires_at").eq("event_id", "meta-hackathon-2026"),
    client.from("analytics_events").select("id, type").eq("event_id", "meta-hackathon-2026"),
    client.from("affinity_explanations").select("cache_key", { count: "exact", head: true }),
  ]);

  const errors = [
    events.error && `events: ${events.error.message}`,
    profiles.error && `profiles: ${profiles.error.message}`,
    presence.error && `presence: ${presence.error.message}`,
    analytics.error && `analytics: ${analytics.error.message}`,
    affinity.error && `affinity_explanations: ${affinity.error.message}`,
  ].filter(Boolean);

  if (errors.length > 0) {
    console.log("errors");
    for (const error of errors) console.log(error);
  }

  const profileRows = profiles.data ?? [];
  const presenceRows = presence.data ?? [];
  const analyticsRows = analytics.data ?? [];
  const foundIds = new Set(profileRows.map((row) => row.id));
  const missingProfiles = expectedIds.filter((id) => !foundIds.has(id));
  const notDemo = profileRows.filter((row) => row.demo !== true).map((row) => row.id);
  const presenceDemo = presenceRows.filter((row) => expectedIds.includes(row.profile_id));
  const presenceWrongSource = presenceDemo.filter((row) => row.source !== "demo");
  const now = Date.now();
  const presenceExpired = presenceDemo.filter((row) => Date.parse(row.expires_at) <= now);
  const analyticsSeed = analyticsRows.filter((row) => String(row.id).startsWith("seed-"));

  const checks = {
    event: events.data?.[0]?.id === "meta-hackathon-2026" && events.data[0].demo === true,
    profiles: profileRows.length === 28 && missingProfiles.length === 0,
    allDemo: notDemo.length === 0 && profileRows.length === 28,
    presence: presenceDemo.length === 28,
    presenceSource: presenceWrongSource.length === 0,
    presenceLive: presenceExpired.length === 0,
    analytics: analyticsSeed.length === expectedAnalytics,
    affinityTable: !affinity.error,
  };

  console.log("event", events.data?.[0] ?? null);
  console.log("profiles", profileRows.length, "missing", missingProfiles.length, "notDemo", notDemo.length);
  console.log("presence", presenceDemo.length, "wrongSource", presenceWrongSource.length, "expired", presenceExpired.length);
  console.log("analytics seed", analyticsSeed.length, "total", analyticsRows.length);
  console.log("affinity count", affinity.count ?? 0);
  console.log("checks", JSON.stringify(checks));

  const ok = Object.values(checks).every(Boolean) && errors.length === 0;
  console.log("RESULT", ok ? "ok" : "fail");
  process.exit(ok ? 0 : 1);
}

void main();
