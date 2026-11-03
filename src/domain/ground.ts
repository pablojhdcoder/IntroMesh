import { INTERESTS, SKILLS } from "./catalog";

const catalogTerms = [...INTERESTS, ...SKILLS];

export type GroundedExplanation = {
  source: "model";
  summary: string;
  opener: string;
  citedGoals: string[];
  citedInterests: string[];
  citedSkills: string[];
  complement: string[];
  confidence: "low" | "medium" | "high";
  matchReason?: string;
  sharedSignals?: string[];
  complementarySignals?: string[];
  conversationStarter?: string;
  confidenceNotes?: string;
};

export function unsupportedTerms(text: string, allowed: readonly string[]): string[] {
  const permitted = new Set(allowed.map((item) => item.toLowerCase()));
  return catalogTerms.filter((term) => {
    if (permitted.has(term.toLowerCase())) return false;
    return text.toLowerCase().includes(term.toLowerCase());
  });
}

export function isSubset(cited: readonly string[], allowed: readonly string[]): boolean {
  const permitted = new Set(allowed.map((item) => item.toLowerCase()));
  return cited.every((item) => permitted.has(item.toLowerCase()));
}

export function assertGrounded(
  explanation: GroundedExplanation,
  allowed: { goals: string[]; interests: string[]; skills: string[]; complement: string[] },
): string | null {
  if (!isSubset(explanation.citedGoals, allowed.goals)) return "cited-goal";
  if (!isSubset(explanation.citedInterests, allowed.interests)) return "cited-interest";
  if (!isSubset(explanation.citedSkills, allowed.skills)) return "cited-skill";
  if (!isSubset(explanation.complement, allowed.complement)) return "cited-complement";
  const prose = `${explanation.summary} ${explanation.opener}`;
  const allowedTerms = [...allowed.interests, ...allowed.skills, ...allowed.complement];
  const extra = unsupportedTerms(prose, allowedTerms);
  if (extra.length > 0) return "unsupported-term";
  return null;
}
