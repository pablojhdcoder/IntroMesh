export const GOALS = [
  { id: "cofounder", label: "Encontrar un cofundador" },
  { id: "collaborate", label: "Colaborar en un proyecto" },
  { id: "discipline", label: "Conocer una disciplina" },
  { id: "hackathon", label: "Explorar el hackathon" },
] as const;

export type GoalId = (typeof GOALS)[number]["id"];

export const INTERESTS = [
  "modelos",
  "producto",
  "diseño",
  "datos",
  "clima",
  "salud",
  "educación",
  "hardware",
  "comunidad",
  "privacidad",
] as const;

export const SKILLS = [
  "investigación",
  "prototipado",
  "frontend",
  "backend",
  "facilitación",
  "análisis",
  "hardware",
  "escritura",
] as const;

export const PROJECTS = [
  "mapa de señales",
  "archivo climático",
  "tutor de oficio",
  "mesa de matching",
  "sensor abierto",
  "bitácora clínica",
] as const;

export const DEMO_EVENT_ID = "meta-hackathon-2026";

export function goalLabel(id: string): string {
  return GOALS.find((goal) => goal.id === id)?.label ?? id;
}
