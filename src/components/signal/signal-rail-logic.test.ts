import { describe, expect, it } from "vitest";
import { filterPeople, sortDirectory, sortRecommendations } from "@/components/signal/signal-rail-logic";

const rec = (id: string, score: number | null, name = id) => ({
  id,
  displayName: name,
  role: "Builder",
  recommendation: score === null ? null : { score },
});
const nameOf = (person: { displayName: string }) => person.displayName;
const textOf = (person: { displayName: string; role: string }) => [person.displayName, person.role];

describe("sortRecommendations", () => {
  it("ordena por score descendente y es estable a igual score", () => {
    const people = [rec("low", 3), rec("top-a", 9), rec("mid", 6), rec("top-b", 9)];
    expect(sortRecommendations(people, "best", nameOf).map((p) => p.id)).toEqual(["top-a", "top-b", "mid", "low"]);
  });

  it("trata sin recomendación como score cero, sin inventar orden", () => {
    const people = [rec("cold", null), rec("hot", 1)];
    expect(sortRecommendations(people, "best", nameOf).map((p) => p.id)).toEqual(["hot", "cold"]);
  });

  it("ordena A–Z por nombre visible", () => {
    const people = [rec("1", 9, "Zoe"), rec("2", 1, "Ana"), rec("3", 5, "Mia")];
    expect(sortRecommendations(people, "az", nameOf).map((p) => p.id)).toEqual(["2", "3", "1"]);
  });

  it("no muta la entrada", () => {
    const people = [rec("b", 1), rec("a", 9)];
    sortRecommendations(people, "best", nameOf);
    expect(people.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("filterPeople", () => {
  it("filtra por nombre, rol y etiquetas sin distinguir mayúsculas", () => {
    const people = [
      { ...rec("ada", 9, "Ada Lovelace"), tags: ["rust"] },
      { ...rec("bea", 8, "Bea"), role: "Design", tags: ["figma"] },
    ];
    const text = (p: (typeof people)[number]) => [p.displayName, p.role, ...p.tags];
    expect(filterPeople(people, "RUST", text).map((p) => p.id)).toEqual(["ada"]);
    expect(filterPeople(people, "design", text).map((p) => p.id)).toEqual(["bea"]);
    expect(filterPeople(people, "  ", text)).toHaveLength(2);
    expect(filterPeople(people, "zzz", text)).toEqual([]);
  });

  it("conserva el texto de búsqueda literal en textOf", () => {
    expect(filterPeople([rec("ada", 9)], "ada", textOf)).toHaveLength(1);
  });
});

describe("sortDirectory", () => {
  it("conserva el orden del servidor en best y ordena en az", () => {
    const people = [rec("1", null, "Zoe"), rec("2", null, "Ana")];
    expect(sortDirectory(people, "best", nameOf).map((p) => p.id)).toEqual(["1", "2"]);
    expect(sortDirectory(people, "az", nameOf).map((p) => p.id)).toEqual(["2", "1"]);
  });
});
