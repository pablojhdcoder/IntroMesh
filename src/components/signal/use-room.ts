// Client-side room fetch cache, in-flight dedupe, and load-state machine.
//
// In-memory only: no dependencies, no refetch-on-focus, no persistence.
// API JSON shapes are frozen; this module only changes when and how the
// client reads them.

import type { FieldPerson } from "@/components/signal/signal-field";

export type Presence = "invisible" | "active" | "seeking";

export type RoomState = "idle" | "loading" | "error" | "empty" | "success";

export type ViewerEmbeddingStatus = "ready" | "pending";

/**
 * Non-recommended attendee: profile card fields + live presence, never a
 * score, reason, or connect action. Rendered in the "Also here" directory.
 */
export type DirectoryPerson = {
  id: string;
  slug: string;
  displayName: string;
  role: string;
  demo: boolean;
  presence: "active" | "seeking";
  interests: string[];
  skills: string[];
};

export type DiscoverySnapshot = {
  people: FieldPerson[];
  directory: DirectoryPerson[];
  presence: Presence;
  viewerEmbeddingStatus: ViewerEmbeddingStatus;
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asPresence(value: unknown): Presence {
  return value === "active" || value === "seeking" || value === "invisible" ? value : "invisible";
}

function asLivePresence(value: unknown): "active" | "seeking" {
  return value === "seeking" ? "seeking" : "active";
}

type RawPerson = {
  id?: unknown;
  slug?: unknown;
  displayName?: unknown;
  role?: unknown;
  demo?: unknown;
  x?: unknown;
  y?: unknown;
  presence?: unknown;
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
    displayName: typeof raw.displayName === "string" ? raw.displayName : "Attendee",
    role: typeof raw.role === "string" ? raw.role : "",
    demo: raw.demo === true,
    x: typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : 50,
    y: typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : 50,
    presence: asLivePresence(raw.presence),
    interests: asStringList(raw.interests),
    skills: asStringList(raw.skills),
    recommendation: toRecommendation(raw.recommendation),
  };
}
function toDirectoryPerson(raw: RawPerson): DirectoryPerson {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    slug: typeof raw.slug === "string" ? raw.slug : "",
    displayName: typeof raw.displayName === "string" ? raw.displayName : "Attendee",
    role: typeof raw.role === "string" ? raw.role : "",
    demo: raw.demo === true,
    presence: asLivePresence(raw.presence),
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
 * `viewerEmbeddingStatus`), with a fallback for the legacy shape where
 * non-recommended rows arrive inside `people` with a null recommendation.
 * Field nodes must only ever come from the returned `people`.
 */
export function normalizeDiscovery(body: unknown): DiscoverySnapshot {
  const raw = (typeof body === "object" && body !== null ? body : {}) as {
    people?: unknown;
    directory?: unknown;
    presence?: unknown;
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
    presence: asPresence(raw.presence),
    viewerEmbeddingStatus: raw.viewerEmbeddingStatus === "pending" ? "pending" : "ready",
  };
}

/** Honest affinity error copy: never invents an explanation. */
export function explainErrorCopy(kind: "match" | "presence" | "meta"): string {
  if (kind === "match") return "Not enough evidence.";
  if (kind === "presence") return "Turn on presence.";
  return "Explanation unavailable — Meta API not configured. Try again.";
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

export function resolveRoomState(args: {
  visible: boolean;
  loading: boolean;
  error: string | null;
  count: number;
}): RoomState {
  // Invisible mode is intentional hiding, never an empty room.
  if (!args.visible) return "idle";
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
  presence: Presence;
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
