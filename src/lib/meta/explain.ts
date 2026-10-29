import { randomUUID } from "node:crypto";
import { goalLabel } from "@/domain/catalog";
import { assertGrounded, demoExplanation, unsupportedTerms, type GroundedExplanation } from "@/domain/ground";
import { presentationSchema, type Presentation, type ProfileInput, type StoredProfile } from "@/domain/profile";
import { MetaApiError, MetaConfigError } from "./errors";
import { createStructuredResponse } from "./client";
import { z } from "zod";

const modelExplanationSchema = z.object({
  summary: z.string().min(1).max(360),
  opener: z.string().min(1).max(220),
  citedGoals: z.array(z.string()).max(2),
  citedInterests: z.array(z.string()).max(4),
  citedSkills: z.array(z.string()).max(4),
  complement: z.array(z.string()).max(3),
  confidence: z.enum(["low", "medium", "high"]),
});

const modelPresentationSchema = z.object({
  headline: z.string().min(1).max(90),
  summary: z.string().min(1).max(360),
  opener: z.string().min(1).max(220),
});

function hasModelKey(): boolean {
  return Boolean(process.env.MODEL_API_KEY);
}

export function modelConfigured(): boolean {
  return hasModelKey();
}

export async function explainAffinity(input: {
  viewer: StoredProfile;
  other: StoredProfile;
  shared: { goals: string[]; interests: string[]; skills: string[] };
  complement: string[];
  confidence: "low" | "medium" | "high";
}): Promise<GroundedExplanation> {
  const goalLabels = input.shared.goals.map(goalLabel);
  if (!hasModelKey()) {
    return demoExplanation({
      otherName: input.other.displayName,
      shared: input.shared,
      complement: input.complement,
      confidence: input.confidence,
      goalLabels,
    });
  }

  const allowed = { ...input.shared, goals: goalLabels, complement: input.complement };
  try {
    const parsed = await createStructuredResponse({
      schema: modelExplanationSchema,
      name: "affinity_explanation",
      instructions:
        "Escribe en español. Usa solo los hechos del JSON. No añadas intereses, habilidades ni objetivos que no estén en las listas. Si la evidencia es escasa, dilo.",
      input: JSON.stringify({
        viewer: input.viewer.displayName,
        other: input.other.displayName,
        otherRole: input.other.role,
        otherProjects: input.other.projects,
        sharedGoals: goalLabels,
        sharedInterests: input.shared.interests,
        sharedSkills: input.shared.skills,
        complement: input.complement,
        confidence: input.confidence,
      }),
    });
    const explanation: GroundedExplanation = { source: "model", ...parsed };
    const problem = assertGrounded(explanation, allowed);
    if (problem) {
      throw new MetaApiError({
        message: "Meta Model API response was not grounded in the profiles",
        status: null,
        type: "invalid_response",
        code: problem,
        param: null,
        retryable: false,
      });
    }
    return explanation;
  } catch (error) {
    if (error instanceof MetaConfigError || error instanceof MetaApiError) throw error;
    throw error;
  }
}

export async function contextualizeProfile(input: ProfileInput): Promise<Presentation> {
  if (!hasModelKey()) {
    const interest = input.interests[0] ?? "este evento";
    return presentationSchema.parse({
      source: "demo",
      headline: `${input.displayName.split(" ")[0]} busca ${goalLabel(input.goal).toLowerCase()}`,
      summary: `${input.role}. ${input.seeking} Declara ${input.interests.slice(0, 3).join(", ")}.`,
      opener: `Estoy buscando conversaciones sobre ${interest}.`,
    });
  }

  const parsed = await createStructuredResponse({
    schema: modelPresentationSchema,
    name: "profile_context",
    instructions:
      "Escribe en español una presentación breve. No inventes empleos, proyectos ni habilidades fuera del JSON.",
    input: JSON.stringify({
      displayName: input.displayName,
      role: input.role,
      interests: input.interests,
      skills: input.skills,
      projects: input.projects,
      offers: input.offers,
      seeking: input.seeking,
      goal: input.goal,
    }),
  });
  const presentation = presentationSchema.parse({ source: "model", ...parsed });
  const allowed = [...input.interests, ...input.skills, ...input.projects, input.role, input.displayName];
  const prose = `${presentation.headline} ${presentation.summary} ${presentation.opener}`;
  if (unsupportedTerms(prose, allowed).length > 0) {
    throw new MetaApiError({
      message: "Meta Model API presentation was not grounded in the profile",
      status: null,
      type: "invalid_response",
      code: "unsupported-term",
      param: null,
      retryable: false,
    });
  }
  return presentation;
}

export function newId(): string {
  return randomUUID();
}
