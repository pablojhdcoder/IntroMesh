// Client-side room fetch cache, in-flight dedupe, and load-state machine.
//
// In-memory only: no dependencies, no refetch-on-focus, no persistence.
// API JSON shapes are frozen; this module only changes when and how the
// client reads them.

import type { FieldPerson } from "@/components/signal/signal-field";

export type RoomState = "loading" | "error" | "empty" | "success";

export type ViewerEmbeddingStatus = "ready" | "pending";

/**
 * Non-recommended attendee: profile card fields, never a score or reason.
 * Connect is allowed with your own words (no model opener, no evidence).
 * Rendered in the "Everyone going" directory.
 */
export type DirectoryPerson = {
  id: string;
  slug: string;
  username: string | null;
  displayName: string;
  role: string;
  demo: boolean;
  interests: string[];
  skills: string[];
};

export type DiscoverySnapshot = {
  people: FieldPerson[];
  directory: DirectoryPerson[];
  viewerEmbeddingStatus: ViewerEmbeddingStatus;
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

type RawPerson = {
  id?: unknown;
  slug?: unknown;
  username?: unknown;
  displayName?: unknown;
  role?: unknown;
  demo?: unknown;
  x?: unknown;
  y?: unknown;
  recommendation?: unknown;
  interests?: unknown;
  skills?: unknown;
};

function toRecommendation(raw: unknown): FieldPerson["recommendation"] {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as {
    score?: unknown;
    confidence?: unknown;
    shared?: unknown;
    complement?: unknown;
  };
  if (typeof candidate.score !== "number" || !Number.isFinite(candidate.score)) return null;
  if (typeof candidate.shared !== "object" || candidate.shared === null) return null;
  const shared = candidate.shared as { goals?: unknown; interests?: unknown; skills?: unknown };
  if (!Array.isArray(shared.goals) || !Array.isArray(shared.interests) || !Array.isArray(shared.skills)) {
    return null;
  }
  if (!Array.isArray(candidate.complement)) return null;
  return {
    score: candidate.score,
    confidence:
      candidate.confidence === "low" || candidate.confidence === "medium" || candidate.confidence === "high"
        ? candidate.confidence
        : "low",
    shared: {
      goals: asStringList(shared.goals),
      interests: asStringList(shared.interests),
      skills: asStringList(shared.skills),
    },
    complement: asStringList(candidate.complement),
  };
}

function toFieldPerson(raw: RawPerson): FieldPerson {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    slug: typeof raw.slug === "string" ? raw.slug : "",
    username: typeof raw.username === "string" && raw.username.length > 0 ? raw.username : null,
    displayName: typeof raw.displayName === "string" ? raw.displayName : "Attendee",
    role: typeof raw.role === "string" ? raw.role : "",
    demo: raw.demo === true,
    x: typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : 50,
    y: typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : 50,
    interests: asStringList(raw.interests),
    skills: asStringList(raw.skills),
    recommendation: toRecommendation(raw.recommendation),
  };
}
function toDirectoryPerson(raw: RawPerson): DirectoryPerson {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    slug: typeof raw.slug === "string" ? raw.slug : "",
    username: typeof raw.username === "string" && raw.username.length > 0 ? raw.username : null,
    displayName: typeof raw.displayName === "string" ? raw.displayName : "Attendee",
    role: typeof raw.role === "string" ? raw.role : "",
    demo: raw.demo === true,
    interests: asStringList(raw.interests),
    skills: asStringList(raw.skills),
  };
}

function hasRecommendation(raw: RawPerson): boolean {
  return toRecommendation(raw.recommendation) !== null;
}

/**
 * Reads the discovery payload against the production contract
 * (`people` = recommended only, `directory` = everyone else,
 * `viewerEmbeddingStatus`). Presence fields from older payloads are ignored.
 * Field nodes must only ever come from the returned `people`.
 */
export function normalizeDiscovery(body: unknown): DiscoverySnapshot {
  const raw = (typeof body === "object" && body !== null ? body : {}) as {
    people?: unknown;
    directory?: unknown;
    viewerEmbeddingStatus?: unknown;
  };
  const rawPeople = Array.isArray(raw.people) ? (raw.people as RawPerson[]) : [];
  const recommended = rawPeople.filter(hasRecommendation).map(toFieldPerson);
  const rawDirectory = Array.isArray(raw.directory) ? (raw.directory as RawPerson[]) : null;
  const directory =
    rawDirectory !== null
      ? rawDirectory.map(toDirectoryPerson)
      : rawPeople.filter((person) => !hasRecommendation(person)).map(toDirectoryPerson);
  return {
    people: recommended,
    directory,
    viewerEmbeddingStatus: raw.viewerEmbeddingStatus === "pending" ? "pending" : "ready",
  };
}

export type ExplainErrorKind = "match" | "presence" | "meta" | "config" | "unavailable";

/** Honest affinity error copy: never invents an explanation, and only
 * blames configuration when the server actually reported it. */
export function explainErrorCopy(kind: ExplainErrorKind): string {
  if (kind === "match") return "Not enough evidence.";
  if (kind === "presence") return "Join the event to see people.";
  if (kind === "config") return "Explanation unavailable — Meta API not configured.";
  return "Explanation unavailable. Try again.";
}

/**
 * Accept/decline payload builder. Accept flow is real only: there is no
 * `simulateDemo` key anymore, sending it is forbidden.
 */
export function connectionActionBody(
  connectionId: string,
  action: "accept" | "decline",
): { connectionId: string; action: "accept" | "decline" } {
  return { connectionId, action };
}

export function resolveRoomState(args: { loading: boolean; error: string | null; count: number }): RoomState {
  // A failed load is an error, never an empty room.
  if (args.error) return "error";
  // A cached roster stays on screen while a background refresh runs.
  if (args.count > 0) return "success";
  // No confirmed data yet: hold the skeleton, never the empty text.
  if (args.loading) return "loading";
  return "empty";
}

export type RoomSnapshot<Connection> = {
  people: FieldPerson[];
  connections: Connection[];
  directory?: DirectoryPerson[];
  viewerEmbeddingStatus?: ViewerEmbeddingStatus;
  at: number;
};

const roomCache = new Map<string, RoomSnapshot<never>>();

export function getCachedRoom<Connection>(eventId: string): RoomSnapshot<Connection> | null {
  return (roomCache.get(eventId) as RoomSnapshot<Connection> | undefined) ?? null;
}

export function setCachedRoom<Connection>(eventId: string, snapshot: RoomSnapshot<Connection>): void {
  roomCache.set(eventId, snapshot as RoomSnapshot<never>);
}

export function clearRoomCache(): void {
  roomCache.clear();
}

export type JsonResult = { ok: boolean; body: unknown };

const inflight = new Map<string, Promise<JsonResult>>();

export function fetchJsonDeduped(key: string, url: string): Promise<JsonResult> {
  const hit = inflight.get(key);
  if (hit) return hit;
  const task: Promise<JsonResult> = (async (): Promise<JsonResult> => {
    try {
      const response = await fetch(url);
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { ok: response.ok, body };
    } catch {
      return { ok: false, body: null };
    }
  })();
  inflight.set(key, task);
  const release = () => {
    if (inflight.get(key) === task) inflight.delete(key);
  };
  void task.then(release, release);
  return task;
}

export function clearInflight(): void {
  inflight.clear();
}
