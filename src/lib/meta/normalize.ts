import { z } from "zod";
import { dropUnsupported, NORMALIZE_PROMPT, redactSensitive, structuredIdentitySchema, type StructuredIdentity } from "@/domain/identity/schema";
import { createStructuredResponse } from "./client";

const wireSchema = z.object({
  display_name: z.string(),
  professional_role: z.string(),
  short_bio: z.string(),
  interests: z.array(z.string()),
  skills: z.array(z.string()),
  projects: z.array(z.string()),
  can_offer: z.array(z.string()),
  looking_for: z.array(z.string()),
  professional_focus: z.array(z.string()),
  conversation_topics: z.array(z.string()),
  languages: z.array(z.string()),
  profile_summary: z.string(),
});

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function userIdentity(displayName: string, description: string): StructuredIdentity {
  const text = description.trim().slice(0, 500);
  return structuredIdentitySchema.parse({
    display_name: displayName.trim(),
    professional_role: null,
    short_bio: text || null,
    interests: [],
    skills: [],
    projects: [],
    can_offer: [],
    looking_for: [],
    professional_focus: [],
    conversation_topics: [],
    languages: [],
    profile_summary: text || null,
  });
}

export async function normalizeDescription(input: {
  displayName: string;
  description: string;
}): Promise<{ identity: StructuredIdentity; usage: { input: number | null; output: number | null } }> {
  const usage = { input: null as number | null, output: null as number | null };
  const identity = await normalizeIdentity(input, usage);
  return { identity, usage };
}

export async function normalizeIdentity(
  input: { displayName: string; description: string },
  usage?: { input: number | null; output: number | null },
): Promise<StructuredIdentity> {
  const description = redactSensitive(input.description);
  if (description.length < 20) {
    throw new Error("description was emptied by the sensitive-data filter");
  }
  const parsed = await createStructuredResponse({
    schema: wireSchema,
    name: "profile_identity",
    instructions: NORMALIZE_PROMPT,
    usage,
    input: JSON.stringify({ display_name: input.displayName, description }),
  });
  const drafted = structuredIdentitySchema.parse({
    display_name: input.displayName,
    professional_role: emptyToNull(parsed.professional_role),
    short_bio: emptyToNull(parsed.short_bio),
    interests: parsed.interests,
    skills: parsed.skills,
    projects: parsed.projects,
    can_offer: parsed.can_offer,
    looking_for: parsed.looking_for,
    professional_focus: parsed.professional_focus,
    conversation_topics: parsed.conversation_topics,
    languages: parsed.languages,
    profile_summary: emptyToNull(parsed.profile_summary),
  });
  return dropUnsupported(drafted, description);
}
