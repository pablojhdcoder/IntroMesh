export const MATCH_WEIGHTS = {
  goal: 3,
  interest: 2,
  skill: 1,
  complement: 2,
} as const;

export type MatchProfile = {
  id: string;
  displayName: string;
  discoverable: boolean;
  goals: readonly string[];
  interests: readonly string[];
  skills: readonly string[];
  seeking?: string;
  demo?: boolean;
};

export type ScoredCandidate = {
  profile: MatchProfile;
  score: number;
  confidence: "low" | "medium" | "high";
  shared: {
    goals: string[];
    interests: string[];
    skills: string[];
  };
  complement: string[];
};

function overlap(left: readonly string[], right: readonly string[]): string[] {
  const wanted = new Set(right.map((item) => item.toLowerCase()));
  const seen = new Set<string>();
  const shared: string[] = [];

  for (const item of left) {
    const key = item.toLowerCase();
    if (!wanted.has(key) || seen.has(key)) continue;
    seen.add(key);
    shared.push(item);
  }

  return shared;
}

function seekingTokens(seeking: string | undefined): string[] {
  if (!seeking) return [];
  const stop = new Set(["para", "como", "esta", "este", "unos", "unas", "con", "los", "las", "que", "una", "por"]);
  return seeking
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñü]+/i)
    .filter((word) => word.length > 3 && !stop.has(word));
}

export function confidenceFor(signalCount: number): "low" | "medium" | "high" {
  if (signalCount >= 4) return "high";
  if (signalCount >= 2) return "medium";
  return "low";
}

/**
 * Puntúa un conjunto ya reducido (el mismo evento). No compara el evento consigo mismo.
 * Quien no consintió el descubrimiento queda fuera. Sin solapamiento ni complementariedad, no hay candidato.
 *
 * score = objetivos×3 + intereses×2 + habilidades×1 + complementos×2
 */
export function selectCandidates(
  viewer: MatchProfile,
  pool: readonly MatchProfile[],
  limit = 5,
): ScoredCandidate[] {
  const cap = Math.max(0, limit);
  const wanted = new Set(seekingTokens(viewer.seeking));

  return pool
    .filter((profile) => profile.id !== viewer.id && profile.discoverable)
    .map((profile) => {
      const shared = {
        goals: overlap(viewer.goals, profile.goals),
        interests: overlap(viewer.interests, profile.interests),
        skills: overlap(viewer.skills, profile.skills),
      };
      const complement = profile.skills.filter((skill) => {
        const key = skill.toLowerCase();
        return wanted.has(key) && !shared.skills.some((item) => item.toLowerCase() === key);
      });
      const score =
        shared.goals.length * MATCH_WEIGHTS.goal +
        shared.interests.length * MATCH_WEIGHTS.interest +
        shared.skills.length * MATCH_WEIGHTS.skill +
        complement.length * MATCH_WEIGHTS.complement;
      const confidence = confidenceFor(
        shared.goals.length + shared.interests.length + shared.skills.length + complement.length,
      );
      return { profile, score, confidence, shared, complement };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.profile.id.localeCompare(b.profile.id))
    .slice(0, cap);
}
