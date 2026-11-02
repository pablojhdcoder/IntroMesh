// Client-side room fetch cache, in-flight dedupe, and load-state machine.
//
// In-memory only: no dependencies, no refetch-on-focus, no persistence.
// API JSON shapes are frozen; this module only changes when and how the
// client reads them.

import type { FieldPerson } from "@/components/signal/signal-field";

export type Presence = "invisible" | "active" | "seeking";

export type RoomState = "idle" | "loading" | "error" | "empty" | "success";

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
