import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APIError } from "openai";
import { createMetaClient } from "../src/lib/meta/client";
import { MetaConfigError } from "../src/lib/meta/errors";
import { readMetaTextConfig } from "../src/lib/meta/schema";

function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(".env.local"));
loadEnvFile(resolve(".env"));

if (!process.env.MODEL_API_KEY) {
  console.log("MODEL_API_KEY no está configurada. No se ha llamado a la API.");
  console.log("1. Entra en https://dev.meta.ai");
  console.log("2. Abre API keys y pulsa Create API key.");
  console.log("3. Guárdala en .env.local como MODEL_API_KEY=...");
  console.log("4. Vuelve a ejecutar npm run verify:meta");
  process.exit(2);
}

async function main(): Promise<void> {
  const config = readMetaTextConfig();
  const started = Date.now();

  try {
    const client = createMetaClient();
    const response = await client.responses.create({
      model: config.model,
      input: "Reply with the single word: ready",
      reasoning: { effort: "low" },
      max_output_tokens: 256,
    });
    const elapsedMs = Date.now() - started;
    const usable = response.status === "completed" && Boolean(response.output_text?.trim());
    console.log(
      JSON.stringify({
        ok: usable,
        status: response.status,
        model: response.model,
        outputPresent: Boolean(response.output_text?.trim()),
        elapsedMs,
      }),
    );
    process.exit(usable ? 0 : 1);
  } catch (error) {
    const elapsedMs = Date.now() - started;
    if (error instanceof MetaConfigError) {
      console.log(JSON.stringify({ ok: false, type: "config", elapsedMs }));
      process.exit(2);
    }
    if (error instanceof APIError) {
      console.log(
        JSON.stringify({
          ok: false,
          status: error.status ?? null,
          type: "api_error",
          elapsedMs,
        }),
      );
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: false, status: null, type: "request_failed", elapsedMs }));
    process.exit(1);
  }
}

void main();
