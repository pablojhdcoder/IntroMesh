/**
 * Proyección del vecindario al plano del campo de señal.
 *
 * El origen (“Tú”) lo pinta el campo. Esta función reparte al resto: más cerca
 * del centro quien más se parece, con un ángulo estable a partir del vector,
 * sin física ni azar.
 */

export type GraphNode = {
  id: string;
  vector: readonly number[];
  similarity: number;
};

export type GraphPoint = {
  id: string;
  x: number;
  y: number;
};

const CENTER = 50;
const INNER_RADIUS = 16;
const OUTER_RADIUS = 26;

function fnv(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function project(vector: readonly number[], salt: number): number {
  let sum = 0;
  for (let index = 0; index < vector.length; index += 1) {
    const sign = (fnv(`${salt}:${index}`) & 1) === 0 ? 1 : -1;
    sum += sign * vector[index];
  }
  return sum;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function mapSignalGraph(nodes: readonly GraphNode[]): GraphPoint[] {
  const draft = nodes.map((node) => {
    const xAxis = project(node.vector, 1);
    const yAxis = project(node.vector, 2);
    const fallback = ((fnv(node.id) % 360) * Math.PI) / 180;
    const angle = xAxis === 0 && yAxis === 0 ? fallback : Math.atan2(yAxis, xAxis);
    const similarity = clamp(node.similarity, 0, 1);
    return {
      id: node.id,
      angle,
      radius: INNER_RADIUS + (1 - similarity) * (OUTER_RADIUS - INNER_RADIUS),
    };
  });

  draft.sort((a, b) => a.angle - b.angle || a.id.localeCompare(b.id));
  const gap = draft.length > 1 ? ((Math.PI * 2) / draft.length) * 0.55 : 0;
  for (let index = 1; index < draft.length; index += 1) {
    const minimum = draft[index - 1].angle + gap;
    if (draft[index].angle < minimum) draft[index].angle = minimum;
  }

  return draft.map((node) => ({
    id: node.id,
    x: round(clamp(CENTER + Math.cos(node.angle) * node.radius, 22, 78)),
    y: round(clamp(CENTER + Math.sin(node.angle) * node.radius * 0.82, 22, 78)),
  }));
}
