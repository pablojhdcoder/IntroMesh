export const GOALS = [
  { id: "cofounder", label: "Find a cofounder" },
  { id: "collaborate", label: "Collaborate on a project" },
  { id: "discipline", label: "Meet someone in a field" },
  { id: "hackathon", label: "Explore the hackathon" },
] as const;

export type GoalId = (typeof GOALS)[number]["id"];

export const INTERESTS = [
  "models",
  "product",
  "design",
  "data",
  "climate",
  "health",
  "education",
  "hardware",
  "community",
  "privacy",
] as const;

export const SKILLS = [
  "research",
  "prototyping",
  "frontend",
  "backend",
  "facilitation",
  "analysis",
  "hardware",
  "writing",
] as const;

export const PROJECTS = [
  "signal map",
  "climate archive",
  "craft tutor",
  "matching table",
  "open sensor",
  "clinical log",
] as const;

export const DEMO_EVENT_ID = "meta-hackathon-2026";

export function goalLabel(id: string): string {
  return GOALS.find((goal) => goal.id === id)?.label ?? id;
}
