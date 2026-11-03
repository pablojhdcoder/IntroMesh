import { z } from "zod";
import { fail, json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventId: z.string().min(1),
});

export async function POST(request: Request) {
  const started = performance.now();
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  try {
    const body = bodySchema.parse(await request.json());
    const result = await service().setPresence(id, body.eventId);
    if ("error" in result) return json(result, 404);
    const response = json(result);
    response.headers.set("Server-Timing", `app;dur=${Math.max(0, performance.now() - started).toFixed(1)}`);
    return response;
  } catch (error) {
    return fail(error);
  }
}
