import { describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIM } from "@/domain/embedding/azure";
import { MetaConfigError } from "@/lib/meta/errors";
import { embedText } from "./engine";

const ENV = {
  AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
  AZURE_OPENAI_API_KEY: "test-key",
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT: "text-embedding-3-small",
  AZURE_OPENAI_API_VERSION: "2024-10-21",
};

function unitVector(dim = EMBEDDING_DIM): number[] {
  return Array.from({ length: dim }, () => 1 / Math.sqrt(dim));
}

function okResponse(embedding: number[]): Response {
  return new Response(JSON.stringify({ data: [{ embedding }] }), { status: 200 });
}

describe("embedText (Azure)", () => {
  it("posts without a dimensions field and returns the normalized vector", async () => {
    let seenUrl = "";
    let seenBody: Record<string, unknown> = {};
    let seenKey = "";
    const fetcher = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
      seenUrl = url;
      seenBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      seenKey = String((init?.headers as Record<string, string>)["api-key"]);
      // Azure returns a non-normalized vector; the engine normalizes in code.
      return okResponse(Array.from({ length: EMBEDDING_DIM }, () => 2));
    });
    const vector = await embedText("hello builders", fetcher as typeof fetch, { ...ENV });
    expect(seenUrl).toBe(
      "https://example.openai.azure.com/openai/deployments/text-embedding-3-small/embeddings?api-version=2024-10-21",
    );
    expect(seenBody).toEqual({ input: "hello builders" });
    expect(seenKey).toBe("test-key");
    expect(vector).toHaveLength(EMBEDDING_DIM);
    expect(Math.hypot(...vector)).toBeCloseTo(1, 5);
  });

  it("rejects a dimension mismatch without retrying", async () => {
    const fetcher = vi.fn(async (): Promise<Response> => okResponse([1, 2, 3]));
    await expect(embedText("hi", fetcher as typeof fetch, { ...ENV })).rejects.toThrow(/expected 1536/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 once and then succeeds", async () => {
    const fetcher = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(okResponse(unitVector()));
    const vector = await embedText("retry me", fetcher as unknown as typeof fetch, { ...ENV }, async () => {});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(vector).toHaveLength(EMBEDDING_DIM);
  });

  it("gives up after two retries on 5xx", async () => {
    const fetcher = vi.fn(async (): Promise<Response> => new Response("boom", { status: 500 }));
    await expect(
      embedText("hi", fetcher as typeof fetch, { ...ENV }, async () => {}),
    ).rejects.toThrow(/status 500/);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 400", async () => {
    const fetcher = vi.fn(async (): Promise<Response> => new Response("bad", { status: 400 }));
    await expect(embedText("hi", fetcher as typeof fetch, { ...ENV })).rejects.toThrow(/status 400/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("throws a config error when the endpoint or key is missing", async () => {
    const fetcher = vi.fn(async (): Promise<Response> => okResponse(unitVector()));
    await expect(embedText("hi", fetcher as typeof fetch, {})).rejects.toBeInstanceOf(MetaConfigError);
    await expect(
      embedText("hi", fetcher as typeof fetch, { AZURE_OPENAI_ENDPOINT: "https://x" }),
    ).rejects.toBeInstanceOf(MetaConfigError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never fabricates a vector for empty text", async () => {
    const fetcher = vi.fn(async (): Promise<Response> => okResponse(unitVector()));
    await expect(embedText("   ", fetcher as typeof fetch, { ...ENV })).rejects.toThrow(/empty/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a malformed response shape", async () => {
    const fetcher = vi.fn(async (): Promise<Response> => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await expect(embedText("hi", fetcher as typeof fetch, { ...ENV })).rejects.toThrow(/schema/);
  });

  it("waits with capped exponential backoff and jitter between attempts", async () => {
    const fetcher = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(new Response("slow", { status: 429 }))
      .mockResolvedValueOnce(new Response("slow", { status: 503 }))
      .mockResolvedValueOnce(okResponse(unitVector()));
    const sleeps: number[] = [];
    const vector = await embedText(
      "backoff",
      fetcher as unknown as typeof fetch,
      { ...ENV },
      async (ms: number) => {
        sleeps.push(ms);
      },
      () => 0,
    );
    expect(vector).toHaveLength(EMBEDDING_DIM);
    // attempt 1 → 250ms base, attempt 2 → 500ms exponential, zero jitter.
    expect(sleeps).toEqual([250, 500]);
  });

  it("truncates the error body excerpt to ~500 chars", async () => {
    const longBody = `x`.repeat(600);
    const fetcher = vi.fn(async (): Promise<Response> => new Response(`oops ${longBody}`, { status: 400 }));
    let message = "";
    try {
      await embedText("hi", fetcher as typeof fetch, { ...ENV }, async () => {});
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toMatch(/status 400/);
    expect(message).toContain("oops");
    const excerpt = message.slice(message.indexOf("body: ") + "body: ".length);
    expect(excerpt.length).toBeLessThanOrEqual(500);
  });

  it("rejects non-finite embedding values", async () => {
    const fetcher = vi.fn(async (): Promise<Response> =>
      okResponse(Array.from({ length: EMBEDDING_DIM }, () => Number.POSITIVE_INFINITY)),
    );
    await expect(embedText("hi", fetcher as typeof fetch, { ...ENV })).rejects.toThrow(/schema/);
  });
});
