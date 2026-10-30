import { z } from "zod";
import type { GroundedExplanation } from "@/domain/ground";
import { assertGrounded } from "@/domain/ground";
import { createStructuredResponse } from "./client";
import { MetaApiError } from "./errors";

export const MATCH_EXPLANATION_PROMPT = `You are IntroMesh Match Intelligence.

Explain a networking recommendation that was already ranked by deterministic code.

Use only the facts in the JSON. Do not invent shared interests, skills, projects, employers or goals.

Do not output scores or change the ranking.

Write match_reason, shared_signals, complementary_signals, conversation_starter and confidence_notes.

Preserve the language of the profiles. If evidence is thin, say so in confidence_notes.

shared_signals must be copied from shared_evidence.

complementary_signals must be copied from complement_evidence.`;

export const PROMPT_VERSION = "match-explain-v1";

const wireSchema = z.object({
  match_reason: z.string(),
  shared_signals: z.array(z.string()),
  complementary_signals: z.array(z.string()),
  conversation_starter: z.string(),
  confidence_notes: z.string(),
});

function subset(values: readonly string[], allowed: readonly string[]): string[] {
  const permitted = new Set(allowed.map((item) => item.toLowerCase()));
  return values.filter((item) => permitted.has(item.toLowerCase()));
}

export async function explainMatch(input: {
  viewerName: string;
  candidateName: string;
  viewerIdentity: unknown;
  candidateIdentity: unknown;
  viewerIntent: string;
  candidateIntent: string;
  shared: { goals: string[]; interests: string[]; skills: string[] };
  complement: string[];
  confidence: "low" | "medium" | "high";
}): Promise<GroundedExplanation> {
  const sharedEvidence = [...input.shared.goals, ...input.shared.interests, ...input.shared.skills];
  const parsed = await createStructuredResponse({
    schema: wireSchema,
    name: "match_explanation",
    instructions: MATCH_EXPLANATION_PROMPT,
    input: JSON.stringify({
      viewer: input.viewerName,
      candidate: input.candidateName,
      viewer_identity: input.viewerIdentity,
      candidate_identity: input.candidateIdentity,
      viewer_intent: input.viewerIntent,
      candidate_intent: input.candidateIntent,
      shared_evidence: sharedEvidence,
      complement_evidence: input.complement,
      confidence: input.confidence,
    }),
  });
  const explanation: GroundedExplanation = {
    source: "model",
    summary: parsed.match_reason.trim(),
    opener: parsed.conversation_starter.trim(),
    citedGoals: subset(parsed.shared_signals, input.shared.goals),
    citedInterests: subset(parsed.shared_signals, input.shared.interests),
    citedSkills: subset(parsed.shared_signals, input.shared.skills),
    complement: subset(parsed.complementary_signals, input.complement),
    confidence: input.confidence,
    confidenceNotes: parsed.confidence_notes.trim() || undefined,
  };
  const problem = assertGrounded(explanation, {
    goals: input.shared.goals,
    interests: input.shared.interests,
    skills: input.shared.skills,
    complement: input.complement,
  });
  if (problem || !explanation.summary || !explanation.opener) {
    throw new MetaApiError({
      message: "Meta Model API explanation was not grounded in the profiles",
      status: null,
      type: "invalid_response",
      code: problem ?? "empty",
      param: null,
      retryable: false,
    });
  }
  const inventedShared = parsed.shared_signals.filter(
    (item) => !sharedEvidence.some((allowed) => allowed.toLowerCase() === item.toLowerCase()),
  );
  const inventedComplement = parsed.complementary_signals.filter(
    (item) => !input.complement.some((allowed) => allowed.toLowerCase() === item.toLowerCase()),
  );
  if (inventedShared.length > 0 || inventedComplement.length > 0) {
    throw new MetaApiError({
      message: "Meta Model API explanation invented a signal",
      status: null,
      type: "invalid_response",
      code: "unsupported-signal",
      param: null,
      retryable: false,
    });
  }
  return explanation;
}
