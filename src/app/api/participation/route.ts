import { z } from "zod";
import { fail, json, service, viewerId } from "@/lib/http";
import { embedText } from "@/lib/embedding/engine";
import { getStore } from "@/lib/store";
import { processEmbeddingQueue } from "@/server/embeddings";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventId: z.string().min(1),
  intent: z.string().max(1000).default(""),
  consent: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const id = await viewerId();
    if (!id) return json({ error: "profile" }, 401);
    const body = bodySchema.parse(await request.json());
    const result = await service().joinEvent(id, body.eventId, body.intent, body.consent);
    if ("error" in result) {
      const status = result.error === "ended" ? 410 : result.error === "missing" ? 404 : 409;
      return json(result, status);
    }
    setTimeout(() => {
      void processEmbeddingQueue(getStore(), embedText).catch(() => undefined);
    }, 0);
    return json(result);
  } catch (error) {
    return fail(error);
  }
}
