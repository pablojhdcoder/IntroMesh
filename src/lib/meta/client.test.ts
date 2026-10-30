import { beforeEach, describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { createStructuredResponse } from "./client";
import { MetaApiError, MetaRateLimitError } from "./errors";
import { resetMetaRateLimit } from "./rate-limit";
import { affinityExplanationSchema, zodToResponseSchema } from "./schema";

const explanation = {
  summary: "Both are looking for models applied to product.",
  reasons: [{ label: "Objetivo", evidence: "Ambos declararon contratar." }],
  suggestedOpener: "Where in the product are you using models?",
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
  it("closes the object and drops constraints strict mode rejects", () => {
    const schema = zodToResponseSchema(affinityExplanationSchema);
    expect(schema).not.toHaveProperty("$schema");
    expect(schema).not.toHaveProperty("minLength");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["summary", "reasons", "suggestedOpener"]);
  });
});

describe("createStructuredResponse", () => {
  it("returns the explanation when the JSON fits", async () => {
    const result = await createStructuredResponse({
      schema: affinityExplanationSchema,
      name: "affinity_explanation",
      instructions: "Explica la afinidad solo con los atributos declarados.",
      input: "Ada is looking to hire. Bruno declared hire and models.",
      client: fakeClient(explanation),
    });
    expect(result.summary).toBe(explanation.summary);
  });

  it("rejects a response that is not valid JSON", async () => {
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

  it("stops a local burst before calling again", async () => {
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
