import { z } from "zod";
import { DEMO_EVENT_ID, goalLabel } from "@/domain/catalog";
import { claimExplanation, completeExplanation, failExplanation } from "@/domain/cache/explanations";
import { explanationCacheKey, PROMPT_VERSION, RANKING_VERSION } from "@/domain/identity/canonical";
import { assertGrounded, demoExplanation, type GroundedExplanation } from "@/domain/ground";
import { selectCandidates } from "@/domain/matching/select-candidates";
import { isPresenceLive } from "@/domain/presence";
import { createStructuredResponse } from "@/lib/meta/client";
import { shouldCallMetaForAffinity } from "@/lib/meta/explain";
import { readMetaTextConfig } from "@/lib/meta/schema";
import type { Store } from "@/lib/store";
import { recommendationEvidence } from "@/server/recommendations";

const matchExplanationSchema = z.object({
  match_reason: z.string(),
  shared_signals: z.array(z.string()),
  complementary_signals: z.array(z.string()),
  conversation_starter: z.string(),
  confidence_notes: z.string(),
});

const MATCH_PROMPT = `You are IntroMesh. Explain in English why A might talk with B.
Use only the facts in the JSON. Do not invent overlaps, jobs, or scores.
Do not change the numeric signals. If evidence is thin, say so in confidence_notes.
Copy shared_signals and complementary_signals from the allowed lists without paraphrasing.`;

function same(value: string, allowed: readonly string[]): boolean {
  return allowed.some((item) => item.toLowerCase() === value.toLowerCase());
}

export function explainActions(store: Store) {
  return {
    async affinity(
      profileId: string,
      otherId: string,
      regenerate = false,
      eventId = DEMO_EVENT_ID,
    ): Promise<{ error: "profile" | "match" | "presence" } | { explanation: GroundedExplanation; cached: boolean }> {
      const now = Date.now();
      const snapshot = await store.read();
      const viewer = snapshot.profiles.find((item) => item.id === profileId);
      const other = snapshot.profiles.find((item) => item.id === otherId);
      if (!viewer || !other) return { error: "profile" };
      const viewerLive = snapshot.presence.some(
        (record) => record.profileId === viewer.id && record.eventId === eventId && (record.source === "demo" || isPresenceLive(record, now)),
      );
      const otherLive = snapshot.presence.some(
        (record) => record.profileId === other.id && record.eventId === eventId && (record.source === "demo" || isPresenceLive(record, now)),
      );
      if (!viewerLive || !otherLive) return { error: "presence" };
      const [match] = selectCandidates(
        {
          id: viewer.id,
          displayName: viewer.displayName,
          discoverable: true,
          goals: [viewer.goal],
          interests: viewer.interests,
          skills: viewer.skills,
          seeking: viewer.seeking,
        },
        [
          {
            id: other.id,
            displayName: other.displayName,
            discoverable: true,
            goals: [other.goal],
            interests: other.interests,
            skills: other.skills,
          },
        ],
        1,
      );
      const persisted = snapshot.recommendations.find(
        (item) => item.eventId === eventId && item.viewerId === viewer.id && item.candidateId === other.id,
      );
      if (!match && !persisted) return { error: "match" };
      const viewerIdentity = snapshot.identities.find((item) => item.userId === viewer.id);
      const otherIdentity = snapshot.identities.find((item) => item.userId === other.id);
      const viewerContext = snapshot.participations.find((item) => item.userId === viewer.id && item.eventId === eventId);
      const otherContext = snapshot.participations.find((item) => item.userId === other.id && item.eventId === eventId);
      const evidence = persisted ? recommendationEvidence(persisted) : `legacy:${match?.score ?? 0}`;
      const cacheKey = explanationCacheKey({
        eventId,
        viewerRevision: viewerIdentity?.revision ?? 0,
        viewerHash: viewerIdentity?.inputHash ?? viewer.id,
        candidateRevision: otherIdentity?.revision ?? 0,
        candidateHash: otherIdentity?.inputHash ?? other.id,
        viewerContextRevision: viewerContext?.revision ?? 0,
        viewerContextHash: viewerContext?.inputHash ?? "",
        candidateContextRevision: otherContext?.revision ?? 0,
        candidateContextHash: otherContext?.inputHash ?? "",
        evidenceFingerprint: evidence,
        rankingVersion: persisted?.rankingVersion ?? RANKING_VERSION,
        promptVersion: PROMPT_VERSION,
        modelId: readMetaTextConfig().model,
        locale: "en",
      });
      const draft = {
        id: `explain:${viewer.id}:${other.id}:${eventId}`,
        cacheKey,
        eventId,
        viewerId: viewer.id,
        candidateId: other.id,
        modelId: readMetaTextConfig().model,
        promptVersion: PROMPT_VERSION,
        inputFingerprint: evidence,
        createdAt: new Date(now).toISOString(),
      };
      const callMeta = shouldCallMetaForAffinity({
        viewerDemo: viewer.demo,
        otherDemo: other.demo,
        modelConfigured: Boolean(process.env.MODEL_API_KEY),
      });

      // Fast path demo/sin clave: la explicación es pura y síncrona
      // (demoExplanation, <1ms). No necesita lease de 30s, ni bucle de
      // 40 intentos con sleep de 250ms (hasta ~10s), ni 3 snapshots
      // completos (1 read + 2 updates con 13 tablas y vectores cada uno).
      // Todo se resuelve en un único store.update().
      if (!callMeta) {
        return store.update((database) => {
          const txNow = Date.now();
          const txViewer = database.profiles.find((item) => item.id === profileId);
          const txOther = database.profiles.find((item) => item.id === otherId);
          if (!txViewer || !txOther) return { error: "profile" as const };
          const txViewerLive = database.presence.some(
            (record) =>
              record.profileId === txViewer.id &&
              record.eventId === eventId &&
              (record.source === "demo" || isPresenceLive(record, txNow)),
          );
          const txOtherLive = database.presence.some(
            (record) =>
              record.profileId === txOther.id &&
              record.eventId === eventId &&
              (record.source === "demo" || isPresenceLive(record, txNow)),
          );
          if (!txViewerLive || !txOtherLive) return { error: "presence" as const };
          const [txMatch] = selectCandidates(
            {
              id: txViewer.id,
              displayName: txViewer.displayName,
              discoverable: true,
              goals: [txViewer.goal],
              interests: txViewer.interests,
              skills: txViewer.skills,
              seeking: txViewer.seeking,
            },
            [
              {
                id: txOther.id,
                displayName: txOther.displayName,
                discoverable: true,
                goals: [txOther.goal],
                interests: txOther.interests,
                skills: txOther.skills,
              },
            ],
            1,
          );
          const txPersisted = database.recommendations.find(
            (item) => item.eventId === eventId && item.viewerId === txViewer.id && item.candidateId === txOther.id,
          );
          if (!txMatch && !txPersisted) return { error: "match" as const };
          const txViewerIdentity = database.identities.find((item) => item.userId === txViewer.id);
          const txOtherIdentity = database.identities.find((item) => item.userId === txOther.id);
          const txViewerContext = database.participations.find(
            (item) => item.userId === txViewer.id && item.eventId === eventId,
          );
          const txOtherContext = database.participations.find(
            (item) => item.userId === txOther.id && item.eventId === eventId,
          );
          const txEvidence = txPersisted ? recommendationEvidence(txPersisted) : `legacy:${txMatch?.score ?? 0}`;
          const txCacheKey = explanationCacheKey({
            eventId,
            viewerRevision: txViewerIdentity?.revision ?? 0,
            viewerHash: txViewerIdentity?.inputHash ?? txViewer.id,
            candidateRevision: txOtherIdentity?.revision ?? 0,
            candidateHash: txOtherIdentity?.inputHash ?? txOther.id,
            viewerContextRevision: txViewerContext?.revision ?? 0,
            viewerContextHash: txViewerContext?.inputHash ?? "",
            candidateContextRevision: txOtherContext?.revision ?? 0,
            candidateContextHash: txOtherContext?.inputHash ?? "",
            evidenceFingerprint: txEvidence,
            rankingVersion: txPersisted?.rankingVersion ?? RANKING_VERSION,
            promptVersion: PROMPT_VERSION,
            modelId: readMetaTextConfig().model,
            locale: "en",
          });
          if (!regenerate) {
            const hit = database.explanations.find(
              (item) => item.cacheKey === txCacheKey && item.status === "completed" && item.value,
            );
            if (hit?.value) {
              database.metrics.cacheHits += 1;
              return { explanation: hit.value, cached: true as const };
            }
          }
          const txGoalLabels = (txMatch?.shared.goals ?? []).map(goalLabel);
          const txAllowed = {
            goals: txGoalLabels,
            interests: txMatch?.shared.interests ?? txViewer.interests.filter((item) => txOther.interests.includes(item)),
            skills: txMatch?.shared.skills ?? [],
            complement: txMatch?.complement ?? [],
          };
          const txExplanation = demoExplanation({
            otherName: txOther.displayName,
            shared: {
              goals: txMatch?.shared.goals ?? [],
              interests: txAllowed.interests,
              skills: txAllowed.skills,
            },
            complement: txAllowed.complement,
            confidence: txMatch?.confidence ?? "low",
            goalLabels: txGoalLabels,
          });
          const txDraft = {
            id: `explain:${txViewer.id}:${txOther.id}:${eventId}`,
            cacheKey: txCacheKey,
            eventId,
            viewerId: txViewer.id,
            candidateId: txOther.id,
            modelId: readMetaTextConfig().model,
            promptVersion: PROMPT_VERSION,
            inputFingerprint: txEvidence,
            createdAt: new Date(txNow).toISOString(),
          };
          const claimed = claimExplanation(database.explanations, txDraft, txNow, regenerate);
          database.explanations = completeExplanation(
            claimed.records,
            txCacheKey,
            txExplanation,
            null,
            txNow,
          );
          database.metrics.cacheMisses += 1;
          const marker = `view:${txViewer.id}:${txOther.id}:${eventId}`;
          if (!database.analytics.some((item) => item.id === marker)) {
            database.analytics.push({
              id: marker,
              eventId,
              type: "profile_viewed",
              at: new Date().toISOString(),
              topic: txAllowed.interests[0] ?? null,
            });
          }
          return { explanation: txExplanation, cached: false as const };
        });
      }

      for (let attempt = 0; attempt < 40; attempt += 1) {
        const gate = await store.update((database) => {
          const claimed = claimExplanation(database.explanations, draft, Date.now(), regenerate && attempt === 0);
          database.explanations = claimed.records;
          if (claimed.outcome === "hit" && claimed.record.value) {
            database.metrics.cacheHits += 1;
            return { outcome: "hit" as const, value: claimed.record.value };
          }
          if (claimed.outcome === "wait") return { outcome: "wait" as const };
          if (claimed.outcome === "exhausted") return { outcome: "exhausted" as const };
          database.metrics.cacheMisses += 1;
          return { outcome: "claimed" as const };
        });
        if (gate.outcome === "hit") return { explanation: gate.value, cached: true };
        if (gate.outcome === "wait") {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        if (gate.outcome === "exhausted") return { error: "match" };
        try {
          const started = Date.now();
          const goalLabels = (match?.shared.goals ?? []).map(goalLabel);
          const allowed = {
            goals: goalLabels,
            interests: match?.shared.interests ?? viewer.interests.filter((item) => other.interests.includes(item)),
            skills: match?.shared.skills ?? [],
            complement: match?.complement ?? [],
          };
          let explanation: GroundedExplanation;
          let usage: { input: number | null; output: number | null } | null = null;
          if (!callMeta || !match) {
            explanation = demoExplanation({
              otherName: other.displayName,
              shared: { goals: match?.shared.goals ?? [], interests: allowed.interests, skills: allowed.skills },
              complement: allowed.complement,
              confidence: match?.confidence ?? "low",
              goalLabels,
            });
          } else {
            const box = { input: null as number | null, output: null as number | null };
            const parsed = await createStructuredResponse({
              schema: matchExplanationSchema,
              name: "match_explanation",
              instructions: MATCH_PROMPT,
              usage: box,
              input: JSON.stringify({
                viewer: viewerIdentity?.confirmed ?? {
                  display_name: viewer.displayName,
                  role: viewer.role,
                  interests: viewer.interests,
                  skills: viewer.skills,
                  seeking: viewer.seeking,
                },
                candidate: otherIdentity?.confirmed ?? {
                  display_name: other.displayName,
                  role: other.role,
                  interests: other.interests,
                  skills: other.skills,
                  projects: other.projects,
                },
                viewerIntent: viewerContext?.intentText ?? "",
                candidateIntent: otherContext?.intentText ?? "",
                allowed,
                scores: persisted
                  ? {
                      identitySimilarity: persisted.identitySimilarity,
                      contextSimilarity: persisted.contextSimilarity,
                      goalCompatibility: persisted.goalCompatibility,
                      skillComplementarity: persisted.skillComplementarity,
                      sharedInterests: persisted.sharedInterests,
                      finalScore: persisted.finalScore,
                    }
                  : { legacyScore: match.score },
              }),
            });
            const citedInterests = parsed.shared_signals.filter((item) => same(item, allowed.interests));
            const citedSkills = parsed.shared_signals.filter((item) => same(item, allowed.skills));
            const complement = parsed.complementary_signals.filter((item) => same(item, allowed.complement));
            const unknown = parsed.shared_signals.filter((item) => !same(item, allowed.interests) && !same(item, allowed.skills));
            explanation = {
              source: "model",
              summary: parsed.match_reason,
              opener: parsed.conversation_starter,
              citedGoals: [],
              citedInterests,
              citedSkills,
              complement,
              confidence: match.confidence,
              matchReason: parsed.match_reason,
              sharedSignals: parsed.shared_signals,
              complementarySignals: parsed.complementary_signals,
              conversationStarter: parsed.conversation_starter,
              confidenceNotes: parsed.confidence_notes,
            };
            if (unknown.length > 0 || assertGrounded(explanation, allowed)) {
              throw new Error("ungrounded");
            }
            usage = box;
          }
          await store.update((database) => {
            database.explanations = completeExplanation(database.explanations, cacheKey, explanation, usage, Date.now());
            if (callMeta) {
              database.metrics.explanationCalls += 1;
              database.metrics.latencyMs += Date.now() - started;
              if (usage?.input) database.metrics.inputTokens += usage.input;
              if (usage?.output) database.metrics.outputTokens += usage.output;
            }
            const marker = `view:${viewer.id}:${other.id}:${eventId}`;
            if (!database.analytics.some((item) => item.id === marker)) {
              database.analytics.push({
                id: marker,
                eventId,
                type: "profile_viewed",
                at: new Date().toISOString(),
                topic: allowed.interests[0] ?? null,
              });
            }
          });
          return { explanation, cached: false };
        } catch (error) {
          await store.update((database) => {
            database.explanations = failExplanation(
              database.explanations,
              cacheKey,
              error instanceof Error ? error.message : "failed",
              Date.now(),
            );
            database.metrics.failures += 1;
          });
          if (!callMeta) throw error;
          return { error: "match" };
        }
      }
      return { error: "match" };
    },
  };
}
