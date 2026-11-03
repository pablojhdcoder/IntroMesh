import { Module } from "node:module";
import { config } from "dotenv";

/**
 * tsx preload for ops scripts (`worker:embeddings`, `backfill:embeddings`).
 *
 * 1. `server-only` is a Next.js bundler guard that throws on plain import.
 *    Scripts are server-side by construction, so it is stubbed out.
 * 2. tsx does not load `.env` files on its own; load them here so the
 *    scripts see the same env as `next dev` (`.env.local` wins over `.env`).
 */

const nodeModule = Module as unknown as {
  _load: (request: string, parent?: unknown, isMain?: boolean) => unknown;
};

const originalLoad = nodeModule._load.bind(nodeModule);

nodeModule._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

config({ path: [".env.local", ".env"] });
