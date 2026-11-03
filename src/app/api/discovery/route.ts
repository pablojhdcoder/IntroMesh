import { z } from "zod";
import { fail, json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  eventId: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});

export async function GET(request: Request) {
  const started = performance.now();
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  try {
    const parsed = querySchema.parse({
      eventId: new URL(request.url).searchParams.get("eventId") ?? undefined,
    });
    const result = await service().discover(id, parsed.eventId);
    if ("error" in result) return json(result, 404);
    const response = json(result);
    response.headers.set("Server-Timing", `app;dur=${Math.max(0, performance.now() - started).toFixed(1)}`);
    return response;
  } catch (error) {
    return fail(error);
  }
}
