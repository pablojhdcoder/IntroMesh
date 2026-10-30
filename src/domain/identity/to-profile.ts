import type { GoalId } from "@/domain/catalog";
import { GOALS } from "@/domain/catalog";
import type { ProfileInput } from "@/domain/profile";
import type { StructuredIdentity } from "./schema";

const goalIds = new Set<string>(GOALS.map((goal) => goal.id));

/** Cubo compatible con el perfil que ya consume el campo. No añade una profesión. */
export function inferGoal(text: string): GoalId {
  const value = text.toLowerCase();
  if (/cofund|co-found|founder|cofounder/.test(value)) return "cofounder";
  if (/colabor|collaborat/.test(value)) return "collaborate";
  if (/aprender|disciplina|learn/.test(value)) return "discipline";
  return "hackathon";
}

export function toProfileInput(input: {
  displayName: string;
  identity: StructuredIdentity;
  intent: string;
}): ProfileInput {
  const seeking = input.intent.trim() || input.identity.looking_for.join(", ");
  const blob = `${seeking} ${input.identity.looking_for.join(" ")}`;
  const goal = inferGoal(blob);
  return {
    displayName: input.displayName.trim(),
    role: (input.identity.professional_role ?? "").trim().slice(0, 80) || "Participante",
    bio: (input.identity.short_bio ?? input.identity.profile_summary ?? "").slice(0, 400),
    interests: input.identity.interests.map((item) => item.slice(0, 48)).slice(0, 12),
    skills: input.identity.skills.map((item) => item.slice(0, 48)).slice(0, 12),
    projects: input.identity.projects.map((item) => item.slice(0, 80)).slice(0, 8),
    links: [],
    offers: input.identity.can_offer.join(", ").slice(0, 240),
    seeking: seeking.slice(0, 500),
    goal: goalIds.has(goal) ? goal : "hackathon",
  };
}
