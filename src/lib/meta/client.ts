import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError, RateLimitError } from "openai";
import type { z } from "zod";
import { MetaApiError, MetaConfigError, MetaRateLimitError } from "./errors";
import { assertMetaRateLimit } from "./rate-limit";
import { readMetaTextConfig, zodToResponseSchema, type MetaEnv } from "./schema";

const responseName = /^[A-Za-z0-9_-]{1,64}$/;

export function createMetaClient(env: MetaEnv = process.env): OpenAI {
  const apiKey = env.MODEL_API_KEY;
  if (!apiKey) throw new MetaConfigError("MODEL_API_KEY is not set");

  const { baseURL } = readMetaTextConfig(env);
  return new OpenAI({
    apiKey,
    baseURL,
    timeout: 25_000,
    maxRetries: 2,
  });
}

function asMetaError(error: unknown): MetaApiError {
  if (error instanceof MetaApiError) return error;
  if (error instanceof APIConnectionTimeoutError || error instanceof APIConnectionError) {
    return new MetaApiError({
      message: "Meta Model API request failed before a response",
      status: null,
      type: "connection_error",
      code: null,
      param: null,
      retryable: true,
    });
  }
  if (error instanceof RateLimitError) {
    return new MetaApiError({
      message: "Meta Model API rate limit exceeded",
      status: 429,
      type: "rate_limit_error",
      code: "rate_limit_exceeded",
      param: null,
      retryable: true,
    });
  }
  if (error instanceof APIError) {
    const status = error.status ?? null;
    const body = error.error as { type?: string; code?: string | null; param?: string | null } | undefined;
    const retryable = status === null || status === 429 || status >= 500;
    return new MetaApiError({
      message: "Meta Model API request failed",
      status,
      type: body?.type ?? null,
      code: body?.code ?? null,
      param: body?.param ?? null,
      retryable,
    });
  }
  return new MetaApiError({
    message: "Meta Model API request failed",
    status: null,
    type: "unknown_error",
    code: null,
    param: null,
    retryable: false,
  });
}

export async function createStructuredResponse<T>(options: {
  schema: z.ZodType<T>;
  name: string;
  instructions: string;
  input: string;
  client?: OpenAI;
  env?: MetaEnv;
  now?: number;
  usage?: { input: number | null; output: number | null };
}): Promise<T> {
  if (!responseName.test(options.name)) {
    throw new MetaApiError({
      message: "Structured output name is invalid",
      status: 400,
      type: "invalid_request_error",
      code: null,
      param: "text.format.name",
      retryable: false,
    });
  }
  if (!options.instructions.trim() || !options.input.trim()) {
    throw new MetaApiError({
      message: "Structured output instructions and input are required",
      status: 400,
      type: "invalid_request_error",
      code: null,
      param: "input",
      retryable: false,
    });
  }

  const env = options.env ?? process.env;
  const config = readMetaTextConfig(env);
  try {
    assertMetaRateLimit(options.now ?? Date.now(), config.maxRequestsPerMinute);
  } catch {
    throw new MetaRateLimitError();
  }

  const client = options.client ?? createMetaClient(env);

  try {
    const response = await client.responses.create({
      model: config.model,
      input: [
        { role: "system", content: options.instructions },
        { role: "user", content: options.input },
      ],
      text: {
        format: {
          type: "json_schema",
          name: options.name,
          strict: true,
          schema: zodToResponseSchema(options.schema),
        },
      },
      reasoning: { effort: "low" },
      max_output_tokens: 1024,
    });

    if (response.status !== "completed" || !response.output_text) {
      throw new MetaApiError({
        message: "Meta Model API returned an unusable response",
        status: null,
        type: "invalid_response",
        code: response.status ?? null,
        param: null,
        retryable: false,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new MetaApiError({
        message: "Meta Model API returned invalid JSON",
        status: null,
        type: "invalid_response",
        code: null,
        param: null,
        retryable: false,
      });
    }

    const result = options.schema.safeParse(parsed);
    if (!result.success) {
      throw new MetaApiError({
        message: "Meta Model API response did not match the schema",
        status: null,
        type: "invalid_response",
        code: null,
        param: null,
        retryable: false,
      });
    }
    if (options.usage) {
      const usage = response.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      options.usage.input = usage?.input_tokens ?? null;
      options.usage.output = usage?.output_tokens ?? null;
    }
    return result.data;
  } catch (error) {
    throw asMetaError(error);
  }
}
