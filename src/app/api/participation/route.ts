import { after } from "next/server";
import { z } from "zod";
import { fail, json, service, viewerId } from "@/lib/http";
import { getStore } from "@/lib/store";
import { embedText } from "@/lib/embedding/engine";
import { processEmbeddingJob } from "@/server/embeddings";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventId: z.string().min(1),
  intent: z.string().max(1000).default(""),
  consent: z.boolean().default(false),
});

/**
 * Inline embedding (Vercel `after()`): the response goes out first, then
 * this user's event-context job is embedded + recomputed. Best-effort — a
 * failure here leaves the queued job for the retry runner
 * (`npm run worker:embeddings` drains the shared queue) or
 * `npm run backfill:embeddings`.
 */
async function runInlineEventEmbedding(userId: string, eventId: string): Promise<void> {
  try {
    const store = getStore();
    const database = await store.read();
    const job = database.embeddings.find(
      (item) =>
        item.kind === "event" && item.userId === userId && item.eventId === eventId && item.status !== "completed",
    );
    if (!job) return;
    await processEmbeddingJob(store, job.id, embedText);
  } catch (error) {
    // Best-effort: the queued job stays pending for the worker/backfill.
    // Identifiers only — never the prompt, vector, or key.
    console.error(
      `inline event embedding failed userId=${userId} eventId=${eventId} error=${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}
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
    // Enqueue stays the single entry point (scheduleEmbedding inside
    // joinEvent); the inline job below only accelerates this user.
    const userId = id;
    const eventId = body.eventId;
    after(() => {
      void runInlineEventEmbedding(userId, eventId);
    });
    return json(result);
  } catch (error) {
    return fail(error);
  }
}
