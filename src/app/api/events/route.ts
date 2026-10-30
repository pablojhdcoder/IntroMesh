import { z } from "zod";
import { fail, json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const resolved = await service().resolveEvent(code);
    if ("error" in resolved) return json(resolved, resolved.error === "ended" ? 410 : 404);
    return json(resolved);
  }
  return json({ events: await service().listEvents(url.searchParams.get("q") ?? "") });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).default(""),
  category: z.string().trim().max(40).default(""),
  startsAt: z.string().nullable().default(null),
});

export async function POST(request: Request) {
  try {
    const input = createSchema.parse(await request.json());
    const created = await service().createEvent(await viewerId(), input);
    if (created && "error" in created) return json(created, 400);
    return json({ event: created }, 201);
  } catch (error) {
    return fail(error);
  }
}
