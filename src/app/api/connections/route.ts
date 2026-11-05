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
  const parsed = querySchema.safeParse({ eventId: new URL(request.url).searchParams.get("eventId") ?? undefined });
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const result = await service().connections(id, parsed.data.eventId);
  return timed({ connections: result }, started);
}

function timed(body: unknown, started: number) {
  const response = json(body);
  response.headers.set("Server-Timing", `app;dur=${Math.max(0, performance.now() - started).toFixed(1)}`);
  return response;
}

const createSchema = z.object({
  profileId: z.string().min(1),
  intro: z.string().trim().min(1).max(280),
  introSource: z.enum(["model", "user"]),
  eventId: z.string().min(1),
});

const resolveSchema = z.object({
  connectionId: z.string().min(1),
  action: z.enum(["accept", "decline"]),
});

export async function POST(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  try {
    const body = await request.json();
    if ("connectionId" in body) {
      const parsed = resolveSchema.parse(body);
      const result = await service().resolveConnection(id, parsed.connectionId, parsed.action);
      if ("error" in result)
        return json(result, result.error === "forbidden" ? 403 : result.error === "state" ? 409 : 404);
      return json(result);
    }
    const parsed = createSchema.parse(body);
    const result = await service().requestConnection(id, parsed.profileId, parsed.intro, parsed.introSource, parsed.eventId);
    if ("error" in result) return json(result, 403);
    return json({ connection: result });
  } catch (error) {
    return fail(error);
  }
}
