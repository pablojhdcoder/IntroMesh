/**
 * Matemática pura del campo de señal. Sin three, sin React, sin DOM.
 * Convierte las coordenadas 0–100 del servidor en posiciones de mundo
 * y deriva la profundidad del dato, nunca del azar.
 */

export type FieldPoint = {
  id: string;
  x: number;
  y: number;
  score: number | null;
};

export type PlacedPoint = FieldPoint & {
  hot: boolean;
  z: number;
  side: "left" | "right";
};

export type Rgba = { r: number; g: number; b: number; a: number };

export const FIELD_HEIGHT = 4.5;
export const FIELD_WIDTH = 6;
export const SELECTED_LIFT = 0.5;
export const MOBILE_SIGNALS = 3;
export const MOBILE_BREAKPOINT = 720;

const HOT_Z_MIN = 0.4;
const HOT_Z_RANGE = 1.2;
const COLD_Z_MIN = -0.5;
const COLD_Z_RANGE = 0.7;

/** Ancho del plano según la proporción del contenedor, con la altura fija. */
export function fieldWidth(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return FIELD_WIDTH;
  return Math.min(8, Math.max(4.5, FIELD_HEIGHT * aspect * 0.98));
}

/** FNV-1a de 32 bits normalizado a [0, 1). Mismo id, mismo valor. */
export function hashUnit(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

export function worldX(x: number, width = FIELD_WIDTH): number {
  return (clamp(x, 0, 100) / 100 - 0.5) * width;
}

export function worldY(y: number): number {
  return (0.5 - clamp(y, 0, 100) / 100) * FIELD_HEIGHT;
}

/** Recomendados por score descendente (estable), después el resto en su orden. */
export function orderPeople<T extends { id: string; score: number | null }>(people: readonly T[]): T[] {
  const hot = people
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => person.score !== null)
    .sort((a, b) => (b.person.score ?? 0) - (a.person.score ?? 0) || a.index - b.index)
    .map(({ person }) => person);
  const cold = people.filter((person) => person.score === null);
  return [...hot, ...cold];
}

function scoreRange(people: readonly FieldPoint[]): { min: number; max: number } {
  const scores = people.flatMap((person) => (person.score === null ? [] : [person.score]));
  if (scores.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...scores), max: Math.max(...scores) };
}

/**
 * Profundidad derivada del dato. Recomendados delante, más cerca cuanto mayor
 * es el score relativo a los recomendados visibles. El resto detrás, con un
 * desplazamiento determinista por id para que no queden coplanarios.
 */
export function depthFor(point: Pick<FieldPoint, "id" | "score">, range: { min: number; max: number }): number {
  if (point.score === null) {
    return round(COLD_Z_MIN - COLD_Z_RANGE * hashUnit(point.id));
  }
  const span = range.max - range.min;
  const normalized = span <= 0 ? 1 : (point.score - range.min) / span;
  return round(HOT_Z_MIN + HOT_Z_RANGE * clamp(normalized, 0, 1));
}

export function placePeople(people: readonly FieldPoint[]): PlacedPoint[] {
  const range = scoreRange(people);
  return orderPeople(people).map((point) => ({
    ...point,
    hot: point.score !== null,
    z: depthFor(point, range),
    side: point.x >= 50 ? "right" : "left",
  }));
}

/**
 * Recorte móvil: las recomendaciones de mayor score y, si no está entre
 * ellas, la seleccionada. Nunca añade a nadie que no venga en `people`.
 */
export function compactSelection<T extends { id: string; score: number | null }>(
  people: readonly T[],
  selectedId: string | null,
  limit = MOBILE_SIGNALS,
): T[] {
  const top = orderPeople(people)
    .filter((person) => person.score !== null)
    .slice(0, limit);
  if (selectedId && !top.some((person) => person.id === selectedId)) {
    const selected = people.find((person) => person.id === selectedId);
    if (selected) top.push(selected);
  }
  return top;
}

/** cubic-bezier(x1, y1, x2, y2) resuelto por Newton. Devuelve y para un progreso x. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let step = 0; step < 8; step += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-5) break;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    return sampleY(clamp(t, 0, 1));
  };
}

export const easeOut = cubicBezier(0.23, 1, 0.32, 1);

/** Admite #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() con comas o espacios y alfa con barra. */
export function parseCssColor(value: string): Rgba | null {
  const text = value.trim().toLowerCase();
  if (text.startsWith("#")) {
    const hex = text.slice(1);
    if (![3, 4, 6, 8].includes(hex.length) || /[^0-9a-f]/.test(hex)) return null;
    const wide = hex.length <= 4 ? hex.split("").map((char) => char + char).join("") : hex;
    const channel = (offset: number) => parseInt(wide.slice(offset, offset + 2), 16) / 255;
    return {
      r: channel(0),
      g: channel(2),
      b: channel(4),
      a: wide.length === 8 ? channel(6) : 1,
    };
  }
  const match = /^rgba?\((.*)\)$/.exec(text);
  if (!match) return null;
  const [channels, alphaPart] = match[1].split("/");
  const parts = channels
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (alphaPart !== undefined) parts.push(alphaPart.trim());
  if (parts.length < 3 || parts.length > 4) return null;
  const numbers = parts.map((part, index) => {
    const percent = part.endsWith("%");
    const number = Number.parseFloat(part);
    if (!Number.isFinite(number)) return Number.NaN;
    if (index < 3) return percent ? number / 100 : number / 255;
    return percent ? number / 100 : number;
  });
  if (numbers.some((number) => Number.isNaN(number))) return null;
  return {
    r: clamp(numbers[0], 0, 1),
    g: clamp(numbers[1], 0, 1),
    b: clamp(numbers[2], 0, 1),
    a: clamp(numbers[3] ?? 1, 0, 1),
  };
}

export function mixRgba(from: Rgba, to: Rgba, amount: number): Rgba {
  const t = clamp(amount, 0, 1);
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
    a: from.a + (to.a - from.a) * t,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
