import { z } from "zod";
import { structuredIdentitySchema } from "@/domain/identity/schema";
import { fail, json, service, viewerId } from "@/lib/http";
import { embedText } from "@/lib/embedding/engine";
import { getStore } from "@/lib/store";
import { writeProfileId } from "@/lib/session";
import { processEmbeddingQueue } from "@/server/embeddings";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("normalize"),
    displayName: z.string(),
    description: z.string(),
    regenerate: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("confirm"),
    identity: structuredIdentitySchema,
  }),
]);

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    if (body.action === "normalize") {
      const result = await service().normalizeIdentity(await viewerId(), body.displayName, body.description, body.regenerate);
      if ("userId" in result) await writeProfileId(result.userId);
      if ("error" in result) return json(result, 503);
      return json(result);
    }
    const id = await viewerId();
    if (!id) return json({ error: "profile" }, 401);
    const saved = await service().confirmIdentity(id, body.identity);
    if ("error" in saved) return json(saved, 404);
    // Defer so join can persist before the embedding model load contends for the store.
    setTimeout(() => {
      void processEmbeddingQueue(getStore(), embedText).catch(() => undefined);
    }, 0);
    return json(saved);
  } catch (error) {
    return fail(error);
  }
}
