import { after } from "next/server";
import { z } from "zod";
import { structuredIdentitySchema } from "@/domain/identity/schema";
import { fail, json, service, viewerId } from "@/lib/http";
import { writeProfileId } from "@/lib/session";
import { getStore } from "@/lib/store";
import { embedText } from "@/lib/embedding/engine";
import { processEmbeddingJob } from "@/server/embeddings";

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

/**
 * Inline embedding (Vercel `after()`): the response goes out first, then
 * this user's global job is embedded + recomputed. Best-effort — a failure
 * here leaves the queued job for the retry runner
 * (`npm run worker:embeddings` drains the shared queue) or
 * `npm run backfill:embeddings`.
 */
async function runInlineGlobalEmbedding(userId: string): Promise<void> {
  try {
    const store = getStore();
    const database = await store.read();
    const job = database.embeddings.find(
      (item) => item.kind === "global" && item.userId === userId && item.status !== "completed",
    );
    if (!job) return;
    await processEmbeddingJob(store, job.id, embedText);
  } catch (error) {
    // Best-effort: the queued job stays pending for the worker/backfill.
    // Identifiers only — never the prompt, vector, or key.
    console.error(
      `inline global embedding failed userId=${userId} error=${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}

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
    // Enqueue stays the single entry point (scheduleEmbedding inside
    // confirmIdentity); the inline job below only accelerates this user.
    const userId = id;
    after(() => {
      void runInlineGlobalEmbedding(userId);
    });
    return json(saved);
  } catch (error) {
    return fail(error);
  }
}
