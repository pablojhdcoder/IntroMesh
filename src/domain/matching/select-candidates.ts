export type MatchProfile = {
  id: string;
  displayName: string;
  discoverable: boolean;
  goals: readonly string[];
  interests: readonly string[];
  skills: readonly string[];
  demo?: boolean;
};

export type ScoredCandidate = {
  profile: MatchProfile;
  score: number;
  shared: {
    goals: string[];
    interests: string[];
    skills: string[];
  };
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

/**
 * Puntúa un conjunto ya reducido (el mismo evento). No compara el evento consigo mismo.
 * Quien no consintió el descubrimiento queda fuera. Sin solapamiento, no hay candidato.
 */
export function selectCandidates(
  viewer: MatchProfile,
  pool: readonly MatchProfile[],
  limit = 5,
): ScoredCandidate[] {
  const cap = Math.max(0, limit);

  return pool
    .filter((profile) => profile.id !== viewer.id && profile.discoverable)
    .map((profile) => {
      const shared = {
        goals: overlap(viewer.goals, profile.goals),
        interests: overlap(viewer.interests, profile.interests),
        skills: overlap(viewer.skills, profile.skills),
      };
      const score = shared.goals.length * 3 + shared.interests.length * 2 + shared.skills.length;
      return { profile, score, shared };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.profile.id.localeCompare(b.profile.id))
    .slice(0, cap);
}
