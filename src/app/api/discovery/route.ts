import { json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
  const result = await service().discover(id, eventId);
  if ("error" in result) return json(result, 404);
  return json(result);
}
