import { createService } from "@/server";
import { getStore } from "@/lib/store";
import { readProfileId } from "@/lib/session";
import { MetaApiError, MetaRateLimitError } from "@/lib/meta/errors";

export function service() {
  return createService(getStore());
}

export async function viewerId(): Promise<string | null> {
  return readProfileId();
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function fail(error: unknown) {
  if (error instanceof MetaRateLimitError) return json({ error: "rate_limit" }, 429);
  if (error instanceof MetaApiError) {
    return json({ error: error.type ?? "meta", code: error.code }, error.status ?? 502);
  }
  return json({ error: "invalid" }, 400);
}
