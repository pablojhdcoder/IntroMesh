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
 * Posición inicial determinista para un nodo nuevo del grafo 3D.
 * Deriva x/y de las coordenadas 0–100 del servidor y z del dato
 * (score + hash del id), nunca del azar: dos montajes con los mismos
 * datos colocan cada nodo en el mismo sitio y la simulación arranca
 * convergida en lugar de saltar desde posiciones aleatorias.
 */
export function initialNodePosition(
  point: { id: string; x: number; y: number; score: number | null },
  width = FIELD_WIDTH,
): { x: number; y: number; z: number } {
  const jitter = (hashUnit(`${point.id}:pos`) - 0.5) * 0.3;
  const z =
    point.score === null
      ? depthFor(point, { min: 0, max: 0 })
      : depthFor({ id: point.id, score: point.score }, { min: point.score, max: point.score }) + jitter;
  return { x: worldX(point.x, width), y: worldY(point.y), z: Math.round(z * 1000) / 1000 };
}

/** Radios de mundo de las esferas 3D. La raíz y cada persona deben caber sin solaparse. */
export const GALAXY_ROOT_RADIUS = 18;
export const GALAXY_HOT_RADIUS = 10;
export const GALAXY_COLD_RADIUS = 6;

/** Holgura mínima entre superficies de esferas vecinas. */
const GALAXY_GAP = 18;
/** Órbita mínima: raíz + recomendada + holgura, con margen para la etiqueta. */
const GALAXY_MIN_ORBIT = 72;
/** Aplastado vertical de la órbita, el mismo 0.82 del plano del servidor. */
const GALAXY_SQUASH = 0.82;
/** La profundidad del dato (0.4–1.6 / −0.5…−1.2) escalada a mundo. */
const GALAXY_Z_SCALE = 14;

export type GalaxyPosition = { id: string; x: number; y: number; z: number };

/**
 * Layout determinista de la galaxia 3D, sin física: garantiza por
 * construcción que ninguna esfera toca la raíz ni a otra, haya 1, 2 o 30
 * personas, vengan o no en las mismas coordenadas del servidor (el centro
 * 50/50 incluido). Conserva la dirección angular del dato, separa los
 * ángulos que colisionan repartiéndolos en orden circular y agranda la
 * órbita cuando el anillo no da para la separación mínima. El resultado
 * va en el mismo orden de entrada.
 */
export function galaxyLayout(people: readonly FieldPoint[]): GalaxyPosition[] {
  if (people.length === 0) return [];
  const count = people.length;
  // Cuerda que deben respetar dos vecinas: las dos esferas más grandes + holgura.
  const minChord = GALAXY_HOT_RADIUS * 2 + GALAXY_GAP;
  // Órbita necesaria para que `count` nodos quepan en el anillo aplastado.
  const ringOrbit = count > 1 ? minChord / (2 * Math.sin(Math.PI / count) * GALAXY_SQUASH) : 0;
  const orbit = Math.max(GALAXY_MIN_ORBIT, ringOrbit);
  const minAngle = 2 * Math.asin(clamp(minChord / (2 * orbit * GALAXY_SQUASH), 0, 1));

  const draft = people.map((point, index) => {
    const dx = point.x - 50;
    const dy = point.y - 50;
    const angle =
      Math.hypot(dx, dy) < 1e-6 ? hashUnit(`${point.id}:angle`) * Math.PI * 2 : Math.atan2(-dy, dx);
    return { point, index, angle };
  });
  const sorted = [...draft].sort((a, b) => a.angle - b.angle || a.index - b.index);
  // Empuja cada ángulo hasta respetar la separación mínima; si la vuelta
  // completa desborda, reparte en ranuras uniformes en el mismo orden.
  let overflow = false;
  for (let step = 1; step < sorted.length; step += 1) {
    const minimum = sorted[step - 1].angle + minAngle;
    if (sorted[step].angle < minimum) sorted[step].angle = minimum;
  }
  if (sorted.length > 1 && sorted[sorted.length - 1].angle > sorted[0].angle + Math.PI * 2 - minAngle) {
    overflow = true;
  }
  if (overflow) {
    const start = sorted[0].angle;
    sorted.forEach((entry, step) => {
      entry.angle = start + (step * Math.PI * 2) / sorted.length;
    });
  }

  const range = scoreRange(people);
  const positions = new Array<GalaxyPosition>(count);
  for (const entry of sorted) {
    const { point } = entry;
    const jitter = (hashUnit(`${point.id}:orbit`) - 0.5) * 8;
    const radial = orbit + (point.score === null ? 10 : -6) + jitter;
    const z = depthFor(point, range) * GALAXY_Z_SCALE;
    positions[entry.index] = {
      id: point.id,
      x: round(Math.cos(entry.angle) * radial),
      y: round(Math.sin(entry.angle) * radial * GALAXY_SQUASH),
      z: round(z),
    };
  }
  return positions;
}

/**
 * Distancia de cámara que encuadra una esfera de alcance `extent` (centro
 * en el origen) con el FOV vertical por defecto de la escena (50°),
 * respetando la proporción del contenedor: en vertical manda el ancho.
 */
export function galaxyOverviewDistance(extent: number, aspect: number, fovDegrees = 50): number {
  const safeExtent = Number.isFinite(extent) && extent > 0 ? extent : GALAXY_ROOT_RADIUS;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const tanVertical = Math.tan(((fovDegrees * Math.PI) / 180) / 2);
  const tanLimiting = Math.min(tanVertical, tanVertical * safeAspect);
  return Math.round(((safeExtent / tanLimiting) * 1.04 + GALAXY_ROOT_RADIUS) * 10) / 10;
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
