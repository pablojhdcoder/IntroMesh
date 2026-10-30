import { createHash } from "node:crypto";
import type { StructuredIdentity } from "./schema";

export const PROMPT_VERSION = "match-explain-v1";
export const RANKING_VERSION = "hybrid-v1";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function line(label: string, values: readonly string[]): string | null {
  if (values.length === 0) return null;
  return `${label}: ${values.join(", ")}`;
}

/** Texto estable de la identidad confirmada. El mismo orden para todos. */
export function canonicalGlobalText(identity: StructuredIdentity): string {
  return [
    identity.professional_role,
    identity.profile_summary,
    identity.short_bio,
    line("Interests", identity.interests),
    line("Skills", identity.skills),
    line("Projects", identity.projects),
    line("Can offer", identity.can_offer),
    line("Focus", identity.professional_focus),
    line("Topics", identity.conversation_topics),
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");
}

export function canonicalContextText(input: {
  intent: string;
  lookingFor: readonly string[];
  collaboration?: readonly string[];
  eventName: string;
  eventCategory: string;
  eventDescription: string;
}): string {
  return [
    input.intent.trim() || null,
    line("Looking for", input.lookingFor),
    line("Collaboration", input.collaboration ?? []),
    input.eventName ? `Event: ${input.eventName}` : null,
    input.eventCategory ? `Category: ${input.eventCategory}` : null,
    input.eventDescription ? `Context: ${input.eventDescription}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");
}

export function hasEventContext(intent: string, collaboration: readonly string[] = []): boolean {
  return intent.trim().length > 0 || collaboration.some((item) => item.trim().length > 0);
}

export type ExplanationKeyInput = {
  eventId: string;
  viewerRevision: number;
  viewerHash: string;
  candidateRevision: number;
  candidateHash: string;
  viewerContextRevision: number;
  viewerContextHash: string;
  candidateContextRevision: number;
  candidateContextHash: string;
  evidenceFingerprint: string;
  rankingVersion: string;
  promptVersion: string;
  modelId: string;
  locale: string;
};

/** Clave direccional. A→B no coincide con B→A. */
export function explanationCacheKey(input: ExplanationKeyInput): string {
  return sha256(canonicalJson(input));
}

export function shouldNormalize(
  current: { inputHash: string; generated: unknown } | null,
  description: string,
  regenerate: boolean,
): boolean {
  if (regenerate || !current?.generated) return true;
  return current.inputHash !== sha256(description.trim());
}
