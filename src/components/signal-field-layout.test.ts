import { describe, expect, it } from "vitest";
import {
  compactSelection,
  cubicBezier,
  depthFor,
  easeOut,
  fieldWidth,
  hashUnit,
  mixRgba,
  parseCssColor,
  placePeople,
  worldX,
  worldY,
} from "@/components/signal-field-layout";

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
    expect(parseCssColor("#f6f4ef")).toEqual({ r: 246 / 255, g: 244 / 255, b: 239 / 255, a: 1 });
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
