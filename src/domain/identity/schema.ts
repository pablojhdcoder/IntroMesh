import { z } from "zod";

/** Identidad que devuelve Muse Spark. Todos los campos van en el esquema estricto. */
export const structuredIdentitySchema = z.object({
  display_name: z.string(),
  professional_role: z.string().nullable(),
  short_bio: z.string().nullable(),
  interests: z.array(z.string()),
  skills: z.array(z.string()),
  projects: z.array(z.string()),
  can_offer: z.array(z.string()),
  looking_for: z.array(z.string()),
  professional_focus: z.array(z.string()),
  conversation_topics: z.array(z.string()),
  languages: z.array(z.string()),
  profile_summary: z.string().nullable(),
});

export type StructuredIdentity = z.infer<typeof structuredIdentitySchema>;

export const identityDraftSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  description: z.string().trim().min(20).max(2000),
});

export type IdentityDraft = z.infer<typeof identityDraftSchema>;

const blank = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

const list = (values: readonly string[], max: number): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed.length < 2 || seen.has(key)) continue;
    seen.add(key);
    next.push(trimmed);
    if (next.length >= max) break;
  }
  return next;
};

function significantTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñü]+/i)
    .filter((token) => token.length > 3);
}

export function phraseIsSupported(phrase: string, source: string): boolean {
  const tokens = significantTokens(phrase);
  if (tokens.length === 0) return false;
  const haystack = source.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function proseIsSupported(value: string | null, source: string): string | null {
  if (!value) return null;
  const tokens = significantTokens(value);
  if (tokens.length === 0) return null;
  const haystack = source.toLowerCase();
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits / tokens.length >= 0.6 ? value : null;
}

/** Descarta habilidades, proyectos y frases que el texto no sostiene. */
export function dropUnsupported(input: StructuredIdentity, source: string): StructuredIdentity {
  const keep = (values: readonly string[]) => values.filter((value) => phraseIsSupported(value, source));
  return cleanIdentity(
    {
      ...input,
      professional_role: input.professional_role && phraseIsSupported(input.professional_role, source) ? input.professional_role : null,
      short_bio: proseIsSupported(input.short_bio, source),
      profile_summary: proseIsSupported(input.profile_summary, source),
      interests: keep(input.interests),
      skills: keep(input.skills),
      projects: keep(input.projects),
      can_offer: keep(input.can_offer),
      looking_for: keep(input.looking_for),
      professional_focus: keep(input.professional_focus),
      conversation_topics: keep(input.conversation_topics),
      languages: keep(input.languages),
    },
    input.display_name,
  );
}

/** Quita huecos y duplicados. No rellena nada que el modelo no haya devuelto. */
export function cleanIdentity(input: StructuredIdentity, displayName: string): StructuredIdentity {
  return {
    display_name: displayName.trim(),
    professional_role: blank(input.professional_role),
    short_bio: blank(input.short_bio),
    interests: list(input.interests, 12),
    skills: list(input.skills, 12),
    projects: list(input.projects, 8),
    can_offer: list(input.can_offer, 8),
    looking_for: list(input.looking_for, 8),
    professional_focus: list(input.professional_focus, 8),
    conversation_topics: list(input.conversation_topics, 8),
    languages: list(input.languages, 8),
    profile_summary: blank(input.profile_summary),
  };
}

export const NORMALIZE_PROMPT = `You are IntroMesh Profile Intelligence.

Transform the user's free-form professional description into a concise and accurate structured networking identity.

Extract only information explicitly supported by the supplied text.

Identify professional background, skills, interests, projects, professional focus, capabilities, goals and conversation topics.

Remove redundant or irrelevant information.

Clearly distinguish demonstrated abilities, interests and aspirations.

Never invent credentials, experience or professional achievements.

If information is missing, return null or an empty collection.

Write all structured fields and the professional introduction in English. Generate a concise, natural professional introduction.`;

const SENSITIVE =
  /\b(religion|religión|iglesia|gay|lesbian|bisexual|pregnant|embaraz|diagnós|diagnos|cancer|cáncer|muslim|musulm|judío|judio|cristian|orientation|orientación|salary|salario|ingreso)\b/i;

/** No manda al modelo frases que declaran atributos sensibles. */
function supported(label: string, source: string): boolean {
  const haystack = source.toLowerCase();
  const tokens = label
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñü]+/i)
    .filter((word) => word.length > 3);
  if (tokens.length === 0) return haystack.includes(label.trim().toLowerCase());
  return tokens.some((token) => haystack.includes(token));
}

/** Descarta listas que el texto original no sostiene. El resumen se conserva: es paráfrasis pedida. */
export function groundIdentity(identity: StructuredIdentity, source: string): StructuredIdentity {
  const keep = (values: readonly string[]) => values.filter((value) => supported(value, source));
  return {
    ...identity,
    professional_role: identity.professional_role && supported(identity.professional_role, source) ? identity.professional_role : null,
    interests: keep(identity.interests),
    skills: keep(identity.skills),
    projects: keep(identity.projects),
    can_offer: keep(identity.can_offer),
    looking_for: keep(identity.looking_for),
    professional_focus: keep(identity.professional_focus),
    conversation_topics: keep(identity.conversation_topics),
    languages: keep(identity.languages),
  };
}

export function redactSensitive(text: string): string {
  return text
    .split(/(?<=[.!?\n])\s+/)
    .filter((sentence) => !SENSITIVE.test(sentence))
    .join(" ")
    .trim();
}
