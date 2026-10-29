import { z } from "zod";
import { fail, json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
  return json({ connections: await service().connections(id, eventId) });
}

const createSchema = z.object({
  profileId: z.string().min(1),
  intro: z.string().trim().min(1).max(280),
  introSource: z.enum(["model", "demo", "user"]),
});

const resolveSchema = z.object({
  connectionId: z.string().min(1),
  action: z.enum(["accept", "decline"]),
  simulateDemo: z.boolean().optional(),
});

export async function POST(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  try {
    const body = await request.json();
    if ("connectionId" in body) {
      const parsed = resolveSchema.parse(body);
      const result = await service().resolveConnection(id, parsed.connectionId, parsed.action, Boolean(parsed.simulateDemo));
      if ("error" in result) return json(result, result.error === "forbidden" ? 403 : 404);
      return json(result);
    }
    const parsed = createSchema.parse(body);
    return json({ connection: await service().requestConnection(id, parsed.profileId, parsed.intro, parsed.introSource) });
  } catch (error) {
    return fail(error);
  }
}
