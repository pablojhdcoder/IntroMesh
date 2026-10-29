import { z } from "zod";
import { fail, json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventId: z.string().min(1),
  enabled: z.boolean(),
  seeking: z.boolean().default(false),
});

export async function POST(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  try {
    const body = bodySchema.parse(await request.json());
    const result = await service().setPresence(id, body.eventId, body.enabled, body.seeking);
    if ("error" in result) return json(result, 404);
    return json(result);
  } catch (error) {
    return fail(error);
  }
}
