import { describe, expect, it } from "vitest";
import {
  compactSelection,
  cubicBezier,
  depthFor,
  easeOut,
  fieldWidth,
  GALAXY_COLD_RADIUS,
  GALAXY_HOT_RADIUS,
  GALAXY_ROOT_RADIUS,
  galaxyLayout,
  galaxyOverviewDistance,
  hashUnit,
  initialNodePosition,
  mixRgba,
  parseCssColor,
  placePeople,
  worldX,
  worldY,
} from "@/components/signal/signal-field-layout";

const people = [
  { id: "cold-a", x: 30, y: 70, score: null },
  { id: "hot-low", x: 70, y: 30, score: 4 },
  { id: "hot-high", x: 50, y: 24, score: 11 },
  { id: "cold-b", x: 60, y: 76, score: null },
  { id: "hot-mid", x: 24, y: 50, score: 7 },
];

describe("placePeople", () => {
  it("ranks recommendations by score and leaves the rest behind", () => {
    const placed = placePeople(people);
    expect(placed.map((point) => point.id)).toEqual(["hot-high", "hot-mid", "hot-low", "cold-a", "cold-b"]);
    expect(placed.slice(0, 3).every((point) => point.hot && point.z > 0)).toBe(true);
    expect(placed.slice(3).every((point) => !point.hot && point.z < 0)).toBe(true);
  });

  it("moves higher scores closer", () => {
    const [high, mid, low] = placePeople(people);
    expect(high.z).toBeGreaterThan(mid.z);
    expect(mid.z).toBeGreaterThan(low.z);
    expect(high.z).toBeCloseTo(1.6, 3);
    expect(low.z).toBeCloseTo(0.4, 3);
  });

  it("es determinista: dos renders con los mismos datos dan la misma escena", () => {
    expect(placePeople(people)).toEqual(placePeople([...people]));
    expect(hashUnit("cold-a")).toBe(hashUnit("cold-a"));
    expect(hashUnit("cold-a")).not.toBe(hashUnit("cold-b"));
  });

  it("no deja coplanarios a los no recomendados", () => {
    const [a, b] = placePeople(people).filter((point) => !point.hot);
    expect(a.z).not.toBe(b.z);
    expect(a.z).toBeLessThanOrEqual(-0.5);
    expect(a.z).toBeGreaterThanOrEqual(-1.2);
  });

  it("places a single recommendation in front", () => {
    expect(depthFor({ id: "solo", score: 3 }, { min: 3, max: 3 })).toBe(1.6);
  });

  it("assigns label side from field half", () => {
    const placed = placePeople(people);
    expect(placed.find((point) => point.id === "hot-mid")?.side).toBe("left");
    expect(placed.find((point) => point.id === "hot-high")?.side).toBe("right");
  });
});

describe("coordenadas de mundo", () => {
  it("centra el plano en el origen e invierte la y", () => {
    expect(worldX(50)).toBe(0);
    expect(worldY(50)).toBe(0);
    expect(worldX(100, 6)).toBe(3);
    expect(worldY(0)).toBe(2.25);
    expect(worldY(100)).toBe(-2.25);
  });

  it("stretches width with aspect within limits", () => {
    expect(fieldWidth(1)).toBe(4.5);
    expect(fieldWidth(4)).toBe(8);
    expect(fieldWidth(Number.NaN)).toBe(6);
  });
});

describe("initialNodePosition", () => {
  it("respeta las coordenadas del servidor en x/y", () => {
    expect(initialNodePosition({ id: "a", x: 0, y: 0, score: null })).toMatchObject({ x: -3, y: 2.25 });
    expect(initialNodePosition({ id: "a", x: 100, y: 100, score: null })).toMatchObject({ x: 3, y: -2.25 });
    expect(initialNodePosition({ id: "a", x: 50, y: 50, score: 5 })).toMatchObject({ x: 0, y: 0 });
  });

  it("es determinista: mismo id, misma posición inicial", () => {
    const point = { id: "hot-high", x: 50, y: 24, score: 11 as const };
    expect(initialNodePosition(point)).toEqual(initialNodePosition({ ...point }));
    const cold: { id: string; x: number; y: number; score: null } = { id: "cold-a", x: 30, y: 70, score: null };
    expect(initialNodePosition(cold)).toEqual(initialNodePosition({ ...cold }));
  });

  it("coloca recomendados delante y el resto detrás sin coplanarios", () => {
    const hot = initialNodePosition({ id: "hot-high", x: 50, y: 24, score: 11 });
    expect(hot.z).toBeGreaterThan(0);
    const a = initialNodePosition({ id: "cold-a", x: 30, y: 70, score: null });
    const b = initialNodePosition({ id: "cold-b", x: 60, y: 76, score: null });
    expect(a.z).toBeLessThan(0);
    expect(b.z).toBeLessThan(0);
    expect(a.z).not.toBe(b.z);
  });
});

describe("galaxyLayout", () => {
  const radiusOf = (score: number | null) => (score === null ? GALAXY_COLD_RADIUS : GALAXY_HOT_RADIUS);
  const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  it("con una sola persona en el centro no la mete dentro del nodo raíz", () => {
    const [only] = galaxyLayout([{ id: "solo", x: 50, y: 50, score: 9 }]);
    expect(distance(only, { x: 0, y: 0, z: 0 })).toBeGreaterThanOrEqual(GALAXY_ROOT_RADIUS + GALAXY_HOT_RADIUS + 12);
  });

  it("con dos personas en las mismas coordenadas del servidor no colapsan", () => {
    const laid = galaxyLayout([
      { id: "a", x: 50, y: 50, score: 9 },
      { id: "b", x: 50, y: 50, score: 8 },
    ]);
    expect(distance(laid[0], laid[1])).toBeGreaterThanOrEqual(GALAXY_HOT_RADIUS * 2 + 8);
    for (const point of laid) {
      expect(distance(point, { x: 0, y: 0, z: 0 })).toBeGreaterThanOrEqual(GALAXY_ROOT_RADIUS + GALAXY_HOT_RADIUS + 12);
    }
  });

  it("mantiene la separación con muchos nodos, también repetidos", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      id: `p-${index}`,
      x: 50,
      y: 50,
      score: index % 3 === 0 ? null : 10 - (index % 5),
    }));
    const laid = galaxyLayout(many);
    expect(laid.map((point) => point.id)).toEqual(many.map((point) => point.id));
    for (let i = 0; i < laid.length; i += 1) {
      expect(distance(laid[i], { x: 0, y: 0, z: 0 })).toBeGreaterThanOrEqual(
        GALAXY_ROOT_RADIUS + radiusOf(many[i].score) + 8,
      );
      for (let j = i + 1; j < laid.length; j += 1) {
        expect(distance(laid[i], laid[j])).toBeGreaterThanOrEqual(radiusOf(many[i].score) + radiusOf(many[j].score) + 4);
      }
    }
  });

  it("es determinista y respeta la dirección del servidor", () => {
    const input = [
      { id: "right", x: 78, y: 50, score: 9 },
      { id: "left", x: 22, y: 50, score: 9 },
    ];
    expect(galaxyLayout(input)).toEqual(galaxyLayout([...input].reverse()).reverse());
    const laid = galaxyLayout(input);
    expect(laid[0].x).toBeGreaterThan(0);
    expect(laid[1].x).toBeLessThan(0);
  });

  it("sin personas no devuelve nada", () => {
    expect(galaxyLayout([])).toEqual([]);
  });
});

describe("galaxyOverviewDistance", () => {
  it("encuadra el alcance completo y se aleja más en vertical que en horizontal", () => {
    const portrait = galaxyOverviewDistance(100, 0.5);
    const landscape = galaxyOverviewDistance(100, 2);
    expect(portrait).toBeGreaterThan(landscape);
    expect(landscape).toBeGreaterThan(100);
  });

  it("con alcance cero devuelve una distancia segura", () => {
    expect(galaxyOverviewDistance(0, 1)).toBeGreaterThan(0);
    expect(galaxyOverviewDistance(Number.NaN, Number.NaN)).toBeGreaterThan(0);
  });
});

describe("compactSelection", () => {
  it("on mobile keeps the three highest-score signals", () => {
    const shown = compactSelection(people, null);
    expect(shown.map((point) => point.id)).toEqual(["hot-high", "hot-mid", "hot-low"]);
  });

  it("adds the selected person if missing from signals", () => {
    const shown = compactSelection(people, "cold-b", 2);
    expect(shown.map((point) => point.id)).toEqual(["hot-high", "hot-mid", "cold-b"]);
  });

  it("no inventa a nadie", () => {
    expect(compactSelection(people, "ghost", 2)).toHaveLength(2);
    expect(compactSelection([], "ghost")).toEqual([]);
  });
});

describe("easeOut", () => {
  it("respects bounds and stays monotonic", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    let previous = 0;
    for (let step = 1; step <= 20; step += 1) {
      const value = easeOut(step / 20);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(easeOut(0.3)).toBeGreaterThan(0.6);
    expect(cubicBezier(0, 0, 1, 1)(0.5)).toBeCloseTo(0.5, 3);
  });
});

describe("parseCssColor", () => {
  it("lee hexadecimal y rgb con barra de alfa", () => {
    expect(parseCssColor("#f4f4f5")).toEqual({ r: 244 / 255, g: 244 / 255, b: 245 / 255, a: 1 });
    expect(parseCssColor(" #fff ")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseCssColor("rgb(22 24 15 / 0.22)")).toEqual({ r: 22 / 255, g: 24 / 255, b: 15 / 255, a: 0.22 });
    expect(parseCssColor("rgba(214, 255, 74, 0.35)")).toEqual({ r: 214 / 255, g: 1, b: 74 / 255, a: 0.35 });
  });

  it("devuelve null ante valores que no entiende", () => {
    expect(parseCssColor("")).toBeNull();
    expect(parseCssColor("oklch(0.5 0.1 120)")).toBeNull();
    expect(parseCssColor("#zzz")).toBeNull();
  });

  it("mezcla colores de forma lineal", () => {
    const mixed = mixRgba({ r: 0, g: 0, b: 0, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }, 0.5);
    expect(mixed).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
  });
});
