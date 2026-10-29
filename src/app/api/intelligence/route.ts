import { json, service } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
  return json(await service().intelligence(eventId));
}
