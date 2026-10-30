import type { HybridEvent, HybridProfile } from "./hybrid";
import { confidenceForScore, MIN_FINAL_SCORE, RECOMMENDATION_LIMIT, RETRIEVAL_LIMIT, retrieveBySimilarity, scorePair } from "./hybrid";

export type RoomPerson = {
  id: string;
  global: readonly number[] | null;
  context: readonly number[] | null;
  profile: HybridProfile;
  interests: readonly string[];
  skills: readonly string[];
  goal: string;
};

function overlap(left: readonly string[], right: readonly string[]): string[] {
  const wanted = new Set(right.map((item) => item.toLowerCase()));
  return left.filter((item) => wanted.has(item.toLowerCase()));
}

/**
 * Un visor contra un vecindario ya recortado por coseno.
 * No puntúa el producto cartesiano del evento.
 */
export function rankRoom(input: {
  viewer: RoomPerson;
  pool: readonly RoomPerson[];
  event: HybridEvent;
}): {
  rows: {
    candidateId: string;
    identitySimilarity: number | null;
    contextSimilarity: number | null;
    cosineDistance: number | null;
    goalCompatibility: number | null;
    skillComplementarity: number | null;
    sharedInterests: number | null;
    eventRelevance: number | null;
    finalScore: number;
    confidence: "low" | "medium" | "high";
    sharedGoalLabels: string[];
    sharedInterestLabels: string[];
    sharedSkillLabels: string[];
    complementLabels: string[];
    rankingVersion: string;
  }[];
  searches: number;
  comparisons: number;
} {
  if (!input.viewer.global) return { rows: [], searches: 0, comparisons: 0 };
  const others = input.pool.filter((person) => person.id !== input.viewer.id && person.global);
  const globalHits = retrieveBySimilarity(
    input.viewer.global,
    others.map((person) => ({ item: person, vector: person.global })),
    RETRIEVAL_LIMIT,
  );
  let searches = 1;
  const contextHits = input.viewer.context
    ? retrieveBySimilarity(
        input.viewer.context,
        others.flatMap((person) => (person.context ? [{ item: person, vector: person.context }] : [])),
        RETRIEVAL_LIMIT,
      )
    : [];
  if (input.viewer.context) searches += 1;
  const chosen = [...new Set([...globalHits, ...contextHits].map((hit) => hit.item.id))];
  const byId = new Map(others.map((person) => [person.id, person]));
  const globalMap = new Map(globalHits.map((hit) => [hit.item.id, hit.similarity]));
  const contextMap = new Map(contextHits.map((hit) => [hit.item.id, hit.similarity]));

  const rows = chosen.flatMap((id) => {
    const candidate = byId.get(id);
    if (!candidate) return [];
    const identity = globalMap.get(id) ?? null;
    const context = input.viewer.context && candidate.context ? (contextMap.get(id) ?? null) : null;
    const scored = scorePair(input.viewer.profile, candidate.profile, input.event, { identity, context });
    if (scored.finalScore < MIN_FINAL_SCORE) return [];
    const parts = {
      semantic: scored.identitySimilarity,
      goal: scored.goalCompatibility,
      skill: scored.skillComplementarity,
      interest: scored.sharedInterests,
      event: scored.eventRelevance,
    };
    return [
      {
        candidateId: id,
        ...scored,
        confidence: confidenceForScore(parts),
        sharedGoalLabels: input.viewer.goal && input.viewer.goal === candidate.goal ? [input.viewer.goal] : [],
        sharedInterestLabels: overlap(input.viewer.interests, candidate.interests),
        sharedSkillLabels: overlap(input.viewer.skills, candidate.skills),
        complementLabels: candidate.skills.filter((skill) => {
          const key = skill.toLowerCase();
          const wanted = input.viewer.profile.lookingFor.some((item) => item.toLowerCase() === key);
          const own = input.viewer.skills.some((item) => item.toLowerCase() === key);
          return wanted && !own;
        }),
      },
    ];
  });
  rows.sort((left, right) => right.finalScore - left.finalScore || left.candidateId.localeCompare(right.candidateId));
  return { rows: rows.slice(0, RECOMMENDATION_LIMIT), searches, comparisons: chosen.length };
}
