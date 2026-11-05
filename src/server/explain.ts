import { z } from "zod";
import { DEMO_EVENT_ID, INTERESTS, SKILLS } from "@/domain/catalog";
import { claimExplanation, completeExplanation, failExplanation } from "@/domain/cache/explanations";
import { explanationCacheKey, PROMPT_VERSION, RANKING_VERSION } from "@/domain/identity/canonical";
import { assertGrounded, type GroundedExplanation } from "@/domain/ground";
import { createStructuredResponse } from "@/lib/meta/client";
import { readMetaTextConfig } from "@/lib/meta/schema";
import type { Database, Store } from "@/lib/store";
import { modelConfigured } from "@/lib/meta/explain";
import { recommendationEvidence } from "@/server/recommendations";

type AffinityFastStore = Store & {
  readAffinitySnapshot?: (profileId: string, otherId: string, eventId: string) => Promise<Database>;
};

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
Copy shared_signals only from allowed.goals, allowed.interests and allowed.skills, and complementary_signals only from allowed.complement, without paraphrasing. If a list is empty, return an empty list for it.
In match_reason and conversation_starter, only name interests or skills listed in proseTerms.`;

function same(value: string, allowed: readonly string[]): boolean {
  return allowed.some((item) => item.toLowerCase() === value.toLowerCase());
}

const CATALOG_TERMS = [...INTERESTS, ...SKILLS];

/**
 * Catalog terms either profile actually declared about itself, in any of
 * its free-text fields. Prose may name these facts (the candidate's own
 * skill in an opener is not an invented overlap); citations may not.
 */
function catalogVocabulary(values: readonly string[]): string[] {
  const text = values.join(" ").toLowerCase();
  return CATALOG_TERMS.filter((term) => text.includes(term.toLowerCase()));
}

export function explainActions(store: Store) {
  return {
    async affinity(
      profileId: string,
      otherId: string,
      regenerate = false,
      eventId = DEMO_EVENT_ID,
    ): Promise<
      | { error: "profile" | "match" | "presence" | "meta" | "config" | "unavailable" }
      | { explanation: GroundedExplanation; cached: boolean }
    > {
      const now = Date.now();
      const fast = store as AffinityFastStore;
      const snapshot =
        typeof fast.readAffinitySnapshot === "function"
          ? await fast.readAffinitySnapshot(profileId, otherId, eventId)
          : await store.read();
      const viewer = snapshot.profiles.find((item) => item.id === profileId);
      const other = snapshot.profiles.find((item) => item.id === otherId);
      if (!viewer || !other) return { error: "profile" };
      // Affinity is membership-gated: both sides need a joined participation
      // in this event. Consent/visibility columns are legacy and ignored.
      // The error value stays "presence" for existing clients.
      const viewerParticipation = snapshot.participations.find(
        (item) => item.userId === viewer.id && item.eventId === eventId,
      );
      const otherParticipation = snapshot.participations.find(
        (item) => item.userId === other.id && item.eventId === eventId,
      );
      for (const participation of [viewerParticipation, otherParticipation]) {
        if (!participation || participation.status !== "joined") {
          return { error: "presence" };
        }
      }
      // Read-only: only a persisted write-path recommendation can be explained.
      const persisted = snapshot.recommendations.find(
        (item) => item.eventId === eventId && item.viewerId === viewer.id && item.candidateId === other.id,
      );
      if (!persisted) return { error: "match" };
      if (!modelConfigured()) return { error: "config" };
      const viewerIdentity = snapshot.identities.find((item) => item.userId === viewer.id);
      const otherIdentity = snapshot.identities.find((item) => item.userId === other.id);
      const viewerContext = viewerParticipation;
      const otherContext = otherParticipation;
      const evidence = recommendationEvidence(persisted);
      // Allowed vocabulary comes solely from the stored labels: the model
      // may only cite what the write path persisted.
      const allowed = {
        goals: [...persisted.sharedGoalLabels],
        interests: [...persisted.sharedInterestLabels],
        skills: [...persisted.sharedSkillLabels],
        complement: [...persisted.complementLabels],
      };
      // Facts either side declared about itself: prose may name these, but
      // they never become citations unless the write path persisted them.
      const proseVocabulary = catalogVocabulary([
        viewer.role,
        viewer.bio,
        ...viewer.interests,
        ...viewer.skills,
        ...viewer.projects,
        other.role,
        other.bio,
        ...other.interests,
        ...other.skills,
        ...other.projects,
        ...(viewerIdentity?.confirmed
          ? [
              viewerIdentity.confirmed.professional_role ?? "",
              viewerIdentity.confirmed.short_bio ?? "",
              viewerIdentity.confirmed.profile_summary ?? "",
              ...viewerIdentity.confirmed.interests,
              ...viewerIdentity.confirmed.skills,
              ...viewerIdentity.confirmed.projects,
              ...viewerIdentity.confirmed.professional_focus,
              ...viewerIdentity.confirmed.conversation_topics,
              ...viewerIdentity.confirmed.can_offer,
              ...viewerIdentity.confirmed.looking_for,
            ]
          : []),
        ...(otherIdentity?.confirmed
          ? [
              otherIdentity.confirmed.professional_role ?? "",
              otherIdentity.confirmed.short_bio ?? "",
              otherIdentity.confirmed.profile_summary ?? "",
              ...otherIdentity.confirmed.interests,
              ...otherIdentity.confirmed.skills,
              ...otherIdentity.confirmed.projects,
              ...otherIdentity.confirmed.professional_focus,
              ...otherIdentity.confirmed.conversation_topics,
              ...otherIdentity.confirmed.can_offer,
              ...otherIdentity.confirmed.looking_for,
            ]
          : []),
      ]);
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
        rankingVersion: persisted.rankingVersion ?? RANKING_VERSION,
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
        if (gate.outcome === "exhausted") return { error: "unavailable" };
        try {
          const started = Date.now();
          const box = { input: null as number | null, output: null as number | null };
          let explanation: GroundedExplanation | null = null;
          let instructions = MATCH_PROMPT;
          for (let modelAttempt = 0; modelAttempt < 2 && !explanation; modelAttempt += 1) {
          const parsed = await createStructuredResponse({
            schema: matchExplanationSchema,
            name: "match_explanation",
            instructions,
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
              proseTerms: proseVocabulary,
              scores: {
                identitySimilarity: persisted.identitySimilarity,
                contextSimilarity: persisted.contextSimilarity,
                goalCompatibility: persisted.goalCompatibility,
                skillComplementarity: persisted.skillComplementarity,
                sharedInterests: persisted.sharedInterests,
                finalScore: persisted.finalScore,
              },
            }),
          });
          const citedGoals = parsed.shared_signals.filter((item) => same(item, allowed.goals));
          const citedInterests = parsed.shared_signals.filter((item) => same(item, allowed.interests));
          const citedSkills = parsed.shared_signals.filter((item) => same(item, allowed.skills));
          const complement = parsed.complementary_signals.filter((item) => same(item, allowed.complement));
          const unknown = parsed.shared_signals.filter(
            (item) =>
              !same(item, allowed.goals) && !same(item, allowed.interests) && !same(item, allowed.skills),
          );
          const candidateExplanation: GroundedExplanation = {
            source: "model",
            summary: parsed.match_reason,
            opener: parsed.conversation_starter,
            citedGoals,
            citedInterests,
            citedSkills,
            complement,
            confidence: persisted.confidence,
            matchReason: parsed.match_reason,
            sharedSignals: parsed.shared_signals,
            complementarySignals: parsed.complementary_signals,
            conversationStarter: parsed.conversation_starter,
            confidenceNotes: parsed.confidence_notes,
          };
          const groundingProblem =
            unknown.length > 0 ? `unknown-signal:${unknown[0]}` : assertGrounded(candidateExplanation, allowed, proseVocabulary);
          if (!groundingProblem) {
            explanation = candidateExplanation;
            break;
          }
          // One corrective retry inside the same claim: a grounding rejection
          // is a fixable generation slip, not yet a burned cache attempt.
          if (modelAttempt === 0) {
            instructions = `${MATCH_PROMPT}
Your previous answer used terms outside the allowed lists. Rewrite it: shared_signals and complementary_signals must be copied exactly from the allowed lists, and the prose must only name interests or skills present in the JSON.`;
            continue;
          }
          throw new Error(`ungrounded:${groundingProblem}`);
          }
          if (!explanation) throw new Error("ungrounded:empty");
          await store.update((database) => {
            database.explanations = completeExplanation(database.explanations, cacheKey, explanation, box, Date.now());
            database.metrics.explanationCalls += 1;
            database.metrics.latencyMs += Date.now() - started;
            if (box.input) database.metrics.inputTokens += box.input;
            if (box.output) database.metrics.outputTokens += box.output;
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
          return {
            error:
              error instanceof Error && error.message.startsWith("ungrounded") ? "unavailable" : "meta",
          };
        }
      }
      return { error: "unavailable" };
    },
  };
}
