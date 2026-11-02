import { json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();
  const body = await service().session(await viewerId());
  const response = json(body);
  response.headers.set("Server-Timing", `app;dur=${Math.max(0, performance.now() - started).toFixed(1)}`);
  return response;
}
