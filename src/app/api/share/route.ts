import { z } from "zod";
import { fail, json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ method: z.enum(["link", "qr", "nfc"]) });

export async function POST(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  try {
    const body = bodySchema.parse(await request.json());
    await service().share(id, body.method);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
