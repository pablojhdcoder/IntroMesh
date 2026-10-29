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
    interest ? `los dos marcasteis ${interest}` : null,
    skill ? `compartís ${skill}` : null,
    complement ? `${input.otherName} aporta ${complement}, que encaja con lo que buscas` : null,
  ].filter(Boolean);
  const raw =
    bits.length > 0
      ? `${bits.join("; ")}.`
      : `La señal es débil: solo coincide el objetivo y no hay más evidencia declarada.`;
  const summary = raw.charAt(0).toUpperCase() + raw.slice(1);
  const opener = complement
    ? `¿En qué parte de tu trabajo entra ${complement}?`
    : interest
      ? `¿Qué estás haciendo ahora con ${interest}?`
      : `¿Qué buscas exactamente en este evento?`;
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
