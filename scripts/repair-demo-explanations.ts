import { DEMO_EVENT_ID } from "@/domain/catalog";
import { getStore } from "@/lib/store";
import { refreshViewerRecommendations } from "@/server/recommendations";

/**
 * Repairs the demo room after the grounding fix (match-explain-v2):
 *
 * 1. Drops failed explanation cache rows for the demo event, so pairs that
 *    burned their attempts under the old validator can be explained again.
 * 2. Recomputes persisted recommendations for every joined viewer of the
 *    demo event, so evidence labels come from the token-aware write path.
 *
 * Dry-run by default: pass --apply to write.
 *
 * Run: npx tsx --import ./scripts/node-preload.ts scripts/repair-demo-explanations.ts [--apply]
 */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const store = getStore();

  const database = await store.read();
  const failed = database.explanations.filter(
    (item) => item.eventId === DEMO_EVENT_ID && item.status === "failed",
  );
  const viewers = [
    ...new Set(
      database.participations
        .filter((item) => item.eventId === DEMO_EVENT_ID && item.status === "joined")
        .map((item) => item.userId),
    ),
  ];
  const zeroEvidence = database.recommendations.filter(
    (item) =>
      item.eventId === DEMO_EVENT_ID &&
      item.sharedGoalLabels.length === 0 &&
      item.sharedInterestLabels.length === 0 &&
      item.sharedSkillLabels.length === 0 &&
      item.complementLabels.length === 0,
  );
  process.stdout.write(
    `repair-demo-explanations ${JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      failedExplanations: failed.length,
      joinedViewers: viewers.length,
      zeroEvidenceRows: zeroEvidence.length,
    })}\n`,
  );
  if (!apply) return;

  const result = await store.update((db) => {
    const before = db.explanations.length;
    db.explanations = db.explanations.filter(
      (item) => !(item.eventId === DEMO_EVENT_ID && item.status === "failed"),
    );
    let recomputed = 0;
    for (const viewerId of viewers) {
      if (refreshViewerRecommendations(db, viewerId, DEMO_EVENT_ID)) recomputed += 1;
    }
    return { removedExplanations: before - db.explanations.length, recomputed };
  });
  process.stdout.write(`repair-demo-explanations done ${JSON.stringify(result)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`repair-demo-explanations failed: ${(error as Error).message}\n`);
  process.exit(1);
});
