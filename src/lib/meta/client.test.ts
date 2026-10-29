import { beforeEach, describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { createStructuredResponse } from "./client";
import { MetaApiError, MetaRateLimitError } from "./errors";
import { resetMetaRateLimit } from "./rate-limit";
import { affinityExplanationSchema, zodToResponseSchema } from "./schema";

const explanation = {
  summary: "Los dos buscan modelos aplicados a producto.",
  reasons: [{ label: "Objetivo", evidence: "Ambos declararon contratar." }],
  suggestedOpener: "¿En qué parte del producto estáis usando modelos?",
};

function fakeClient(output: unknown): OpenAI {
  return {
    responses: {
      create: async () => ({
        status: "completed",
        output_text: typeof output === "string" ? output : JSON.stringify(output),
      }),
    },
  } as unknown as OpenAI;
}

beforeEach(() => {
  resetMetaRateLimit();
});

describe("zodToResponseSchema", () => {
  it("cierra el objeto y omite límites que el modo estricto rechaza", () => {
    const schema = zodToResponseSchema(affinityExplanationSchema);
    expect(schema).not.toHaveProperty("$schema");
    expect(schema).not.toHaveProperty("minLength");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["summary", "reasons", "suggestedOpener"]);
  });
});

describe("createStructuredResponse", () => {
  it("devuelve la explicación cuando el JSON encaja", async () => {
    const result = await createStructuredResponse({
      schema: affinityExplanationSchema,
      name: "affinity_explanation",
      instructions: "Explica la afinidad solo con los atributos declarados.",
      input: "Ada busca contratar. Bruno declaró contratar y modelos.",
      client: fakeClient(explanation),
    });
    expect(result.summary).toBe(explanation.summary);
  });

  it("rechaza una respuesta que no es JSON válido", async () => {
    await expect(
      createStructuredResponse({
        schema: affinityExplanationSchema,
        name: "affinity_explanation",
        instructions: "Explica la afinidad.",
        input: "Ada y Bruno.",
        client: fakeClient("no-json"),
      }),
    ).rejects.toMatchObject({ type: "invalid_response" });
  });

  it("corta la ráfaga local antes de seguir llamando", async () => {
    const env = { META_MODEL_MAX_REQUESTS_PER_MINUTE: "1" };
    const options = {
      schema: affinityExplanationSchema,
      name: "affinity_explanation",
      instructions: "Explica la afinidad.",
      input: "Ada y Bruno.",
      client: fakeClient(explanation),
      env,
    };
    await createStructuredResponse(options);
    await expect(createStructuredResponse(options)).rejects.toBeInstanceOf(MetaRateLimitError);
  });

  it("no convierte un error de esquema en un resultado", async () => {
    await expect(
      createStructuredResponse({
        schema: affinityExplanationSchema,
        name: "affinity_explanation",
        instructions: "Explica la afinidad.",
        input: "Ada y Bruno.",
        client: fakeClient({ summary: "" }),
      }),
    ).rejects.toBeInstanceOf(MetaApiError);
  });
});
