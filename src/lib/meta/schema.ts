import { z } from "zod";

const strippedKeywords = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minItems",
  "maxItems",
  "format",
  "pattern",
]);

function normalizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeSchema);
  if (!node || typeof node !== "object") return node;

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (strippedKeywords.has(key)) continue;
    output[key] = normalizeSchema(value);
  }

  if (output.type === "object" && output.properties && typeof output.properties === "object") {
    output.additionalProperties = false;
    output.required = Object.keys(output.properties as Record<string, unknown>);
  }

  return output;
}

/** JSON Schema apto para `text.format` estricto en la Responses API. */
export function zodToResponseSchema(schema: z.ZodType): Record<string, unknown> {
  const json = normalizeSchema(z.toJSONSchema(schema));
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Zod did not produce a JSON schema object");
  }
  return json as Record<string, unknown>;
}

export const affinityExplanationSchema = z.object({
  summary: z.string().min(1).max(280),
  reasons: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        evidence: z.string().min(1).max(240),
      }),
    )
    .min(1)
    .max(3),
  suggestedOpener: z.string().min(1).max(240),
});

export type AffinityExplanation = z.infer<typeof affinityExplanationSchema>;

export const metaTextConfigSchema = z.object({
  baseURL: z.string().url(),
  model: z.string().min(1),
  maxRequestsPerMinute: z.number().int().positive(),
});

export type MetaEnv = Record<string, string | undefined>;

export function readMetaTextConfig(env: MetaEnv = process.env) {
  return metaTextConfigSchema.parse({
    baseURL: env.META_MODEL_BASE_URL || "https://api.meta.ai/v1",
    model: env.META_MODEL_ID || "muse-spark-1.3",
    maxRequestsPerMinute: Number(env.META_MODEL_MAX_REQUESTS_PER_MINUTE || 10),
  });
}
