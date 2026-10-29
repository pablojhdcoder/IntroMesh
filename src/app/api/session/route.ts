import { json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await service().session(await viewerId()));
}
