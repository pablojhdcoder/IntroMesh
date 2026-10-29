import { z } from "zod";
import { fail, json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  profileId: z.string().min(1),
  regenerate: z.boolean().optional(),
});

export async function POST(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  try {
    const body = bodySchema.parse(await request.json());
    const result = await service().affinity(id, body.profileId, body.regenerate);
    if ("error" in result) {
      const status = result.error === "match" ? 422 : result.error === "presence" ? 403 : 404;
      return json(result, status);
    }
    return json(result);
  } catch (error) {
    return fail(error);
  }
}
