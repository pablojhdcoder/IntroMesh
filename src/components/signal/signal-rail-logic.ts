/**
 * Lógica pura del rail de señales: filtrado y ordenación de la lista.
 * Sin React ni DOM, para poder probarla sin renderizar.
 */

export type RailSort = "best" | "az";

/** Filtra por nombre visible, rol y etiquetas. Consulta vacía = todos. */
export function filterPeople<T>(
  people: readonly T[],
  query: string,
  textOf: (person: T) => readonly string[],
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...people];
  return people.filter((person) =>
    textOf(person)
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

/**
 * Orden del rail. "best" = score descendente (estable: a igual score se
 * conserva el orden del servidor); "az" = alfabético por nombre visible.
 */
export function sortRecommendations<T extends { recommendation: { score: number } | null }>(
  people: readonly T[],
  sort: RailSort,
  nameOf: (person: T) => string,
): T[] {
  if (sort === "az") return [...people].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return people
    .map((person, index) => ({ person, index }))
    .sort(
      (a, b) =>
        (b.person.recommendation?.score ?? 0) - (a.person.recommendation?.score ?? 0) || a.index - b.index,
    )
    .map(({ person }) => person);
}

/** Directorio: orden del servidor, o alfabético si se pide. */
export function sortDirectory<T>(people: readonly T[], sort: RailSort, nameOf: (person: T) => string): T[] {
  if (sort === "az") return [...people].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return [...people];
}
