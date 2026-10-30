import { RANKING_VERSION } from "@/domain/identity/canonical";

/** Pesos iniciales. No son probabilidades calibradas. */
export const HYBRID_WEIGHTS = {
  semanticGlobal: 0.35,
  semanticContext: 0.65,
  semantic: 0.4,
  goal: 0.25,
  skill: 0.2,
  interest: 0.1,
  event: 0.05,
} as const;

export const RETRIEVAL_LIMIT = 24;
export const RECOMMENDATION_LIMIT = 8;
export const MIN_FINAL_SCORE = 0.12;

const STOP = new Set([
  "para", "como", "esta", "este", "unos", "unas", "con", "los", "las", "que", "una", "por",
  "the", "and", "for", "with", "from", "this", "that", "your", "you",
]);

export function tokensOf(values: readonly string[]): Set<string> {
  const tokens = new Set<string>();
  for (const value of values) {
    for (const word of value.toLowerCase().split(/[^a-z0-9áéíóúñü]+/i)) {
      if (word.length > 2 && !STOP.has(word)) tokens.add(word);
    }
  }
  return tokens;
}

/** Fracción de lo que A busca y B ofrece. Null si A no declaró nada: no se penaliza. */
export function coverage(wanted: ReadonlySet<string>, offered: ReadonlySet<string>): number | null {
  if (wanted.size === 0) return null;
  let hits = 0;
  for (const token of wanted) if (offered.has(token)) hits += 1;
  return hits / wanted.size;
}

export function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number | null {
  if (left.size === 0 || right.size === 0) return null;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? null : intersection / union;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function semanticCompatibility(identity: number | null, context: number | null): number | null {
  if (identity === null && context === null) return null;
  if (context === null) return clamp01(identity ?? 0);
  if (identity === null) return clamp01(context);
  const weight = HYBRID_WEIGHTS.semanticGlobal + HYBRID_WEIGHTS.semanticContext;
  return clamp01(
    (clamp01(identity) * HYBRID_WEIGHTS.semanticGlobal + clamp01(context) * HYBRID_WEIGHTS.semanticContext) / weight,
  );
}

export type ScoreParts = {
  semantic: number | null;
  goal: number | null;
  skill: number | null;
  interest: number | null;
  event: number | null;
};

/** Renormaliza solo los componentes presentes. */
export function finalScore(parts: ScoreParts): { score: number; weights: Record<string, number> } {
  const rows = [
    ["semantic", parts.semantic, HYBRID_WEIGHTS.semantic],
    ["goal", parts.goal, HYBRID_WEIGHTS.goal],
    ["skill", parts.skill, HYBRID_WEIGHTS.skill],
    ["interest", parts.interest, HYBRID_WEIGHTS.interest],
    ["event", parts.event, HYBRID_WEIGHTS.event],
  ] as const;
  const available = rows.filter((row) => row[1] !== null);
  const total = available.reduce((sum, row) => sum + row[2], 0);
  if (total === 0) return { score: 0, weights: {} };
  const weights: Record<string, number> = {};
  let score = 0;
  for (const [key, value, weight] of available) {
    const share = weight / total;
    weights[key] = share;
    score += (value ?? 0) * share;
  }
  return { score, weights };
}

export type HybridProfile = {
  id: string;
  interests: readonly string[];
  skills: readonly string[];
  lookingFor: readonly string[];
  canOffer: readonly string[];
  focus: readonly string[];
  projects: readonly string[];
  intent: string;
};

export type HybridEvent = {
  name: string;
  category: string;
  description: string;
};

export function scorePair(viewer: HybridProfile, candidate: HybridProfile, event: HybridEvent, similarities: {
  identity: number | null;
  context: number | null;
}): {
  identitySimilarity: number | null;
  contextSimilarity: number | null;
  cosineDistance: number | null;
  goalCompatibility: number | null;
  skillComplementarity: number | null;
  sharedInterests: number | null;
  eventRelevance: number | null;
  finalScore: number;
  rankingVersion: typeof RANKING_VERSION;
} {
  const viewerGoals = tokensOf([...viewer.lookingFor, viewer.intent]);
  const offered = tokensOf([...candidate.canOffer, ...candidate.focus, ...candidate.projects, ...candidate.skills]);
  const candidateSkills = tokensOf(candidate.skills.filter((skill) => !viewer.skills.some((item) => item.toLowerCase() === skill.toLowerCase())));
  const semantic = semanticCompatibility(similarities.identity, similarities.context);
  const eventRelevance = coverage(tokensOf([viewer.intent]), tokensOf([event.name, event.category, event.description]));
  const scored = finalScore({
    semantic,
    goal: coverage(viewerGoals, offered),
    skill: coverage(viewerGoals, candidateSkills.size > 0 ? candidateSkills : tokensOf(candidate.skills)),
    interest: jaccard(tokensOf(viewer.interests), tokensOf(candidate.interests)),
    event: viewer.intent.trim() ? eventRelevance : null,
  });
  const identity = similarities.identity === null ? null : clamp01(similarities.identity);
  return {
    identitySimilarity: identity,
    contextSimilarity: similarities.context === null ? null : clamp01(similarities.context),
    cosineDistance: identity === null ? null : 1 - identity,
    goalCompatibility: coverage(viewerGoals, offered),
    skillComplementarity: coverage(tokensOf(viewer.lookingFor), candidateSkills),
    sharedInterests: jaccard(tokensOf(viewer.interests), tokensOf(candidate.interests)),
    eventRelevance: viewer.intent.trim() ? eventRelevance : null,
    finalScore: scored.score,
    rankingVersion: RANKING_VERSION,
  };
}

export function confidenceForScore(parts: ScoreParts): "low" | "medium" | "high" {
  const active = [parts.semantic, parts.goal, parts.skill, parts.interest, parts.event].filter(
    (value) => value !== null && value > 0,
  ).length;
  if (active >= 4) return "high";
  if (active >= 2) return "medium";
  return "low";
}

/** Recupera como máximo `limit` vecinos del visor. No construye la matriz del evento. */
export function retrieveBySimilarity<T extends { id: string }>(
  viewer: readonly number[] | null,
  pool: readonly { item: T; vector: readonly number[] | null }[],
  limit = RETRIEVAL_LIMIT,
): { item: T; similarity: number | null }[] {
  const cap = Math.max(0, Math.min(limit, RETRIEVAL_LIMIT));
  const ranked = pool
    .filter((entry) => entry.item.id !== "")
    .map((entry) => ({
      item: entry.item,
      similarity:
        viewer && entry.vector && viewer.length === entry.vector.length && viewer.length > 0
          ? Math.max(0, dot(viewer, entry.vector))
          : null,
    }))
    .sort((a, b) => (b.similarity ?? -1) - (a.similarity ?? -1) || a.item.id.localeCompare(b.item.id));
  return ranked.slice(0, cap);
}

export function applyStoredRecommendations<
  T extends {
    id: string;
    x: number;
    y: number;
    recommendation: {
      score: number;
      confidence: "low" | "medium" | "high";
      shared: { goals: string[]; interests: string[]; skills: string[] };
      complement: string[];
    } | null;
  },
>(
  people: readonly T[],
  rows: readonly {
    candidateId: string;
    finalScore: number;
    confidence: "low" | "medium" | "high";
    sharedGoalLabels: readonly string[];
    sharedInterestLabels: readonly string[];
    sharedSkillLabels: readonly string[];
    complementLabels: readonly string[];
  }[],
): T[] {
  if (rows.length === 0) return [...people];
  const byId = new Map(rows.map((row) => [row.candidateId, row]));
  return people.map((person) => {
    const row = byId.get(person.id);
    if (!row) return person;
    return {
      ...person,
      x: person.x,
      y: person.y,
      recommendation: {
        score: Math.round(row.finalScore * 100),
        confidence: row.confidence,
        shared: {
          goals: [...row.sharedGoalLabels],
          interests: [...row.sharedInterestLabels],
          skills: [...row.sharedSkillLabels],
        },
        complement: [...row.complementLabels],
      },
    };
  });
}

function dot(left: readonly number[], right: readonly number[]): number {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) sum += left[index] * right[index];
  return sum;
}
