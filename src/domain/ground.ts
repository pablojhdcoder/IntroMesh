import { INTERESTS, SKILLS } from "./catalog";

const catalogTerms = [...INTERESTS, ...SKILLS];

export type GroundedExplanation = {
  source: "model" | "demo";
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

export function demoExplanation(input: {
  otherName: string;
  shared: { goals: string[]; interests: string[]; skills: string[] };
  complement: string[];
  confidence: "low" | "medium" | "high";
  goalLabels: string[];
}): GroundedExplanation {
  const interest = input.shared.interests[0];
  const skill = input.shared.skills[0];
  const complement = input.complement[0];
  const bits = [
    interest ? `you both marked ${interest}` : null,
    skill ? `you share ${skill}` : null,
    complement ? `${input.otherName} brings ${complement}, which fits what you are looking for` : null,
  ].filter(Boolean);
  const raw =
    bits.length > 0
      ? `${bits.join("; ")}.`
      : `The signal is thin: only the goal overlaps and there is no other declared evidence.`;
  const summary = raw.charAt(0).toUpperCase() + raw.slice(1);
  const opener = complement
    ? `Where does ${complement} show up in your work?`
    : interest
      ? `What are you doing with ${interest} right now?`
      : `What are you hoping to find at this event?`;
  return {
    source: "demo",
    summary,
    opener,
    citedGoals: input.goalLabels,
    citedInterests: input.shared.interests,
    citedSkills: input.shared.skills,
    complement: input.complement,
    confidence: input.confidence,
  };
}
