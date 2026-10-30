export type OnboardingPhase = "event" | "identity" | "intent" | "review" | "done";

export function initialPhase(input: { eventResolved: boolean; identityConfirmed: boolean }): OnboardingPhase {
  if (!input.eventResolved) return "event";
  if (!input.identityConfirmed) return "identity";
  return "intent";
}

export function eventCreationOpen(flag: string | undefined): boolean {
  return flag === "1";
}

export type PublicEvent = {
  id: string;
  name: string;
  description: string;
  category: string;
  startsAt: string | null;
  code: string;
  status: "upcoming" | "live" | "ended";
  demo: boolean;
};

export function eventOpen(event: { status: string } | null | undefined): boolean {
  return Boolean(event && event.status !== "ended");
}

export function searchEvents<T extends PublicEvent>(events: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  const open = events.filter((event) => eventOpen(event));
  if (!needle) return open;
  return open.filter((event) =>
    [event.name, event.description, event.category, event.code].join("\n").toLowerCase().includes(needle),
  );
}

export function resolveInvite<T extends PublicEvent>(
  events: readonly T[],
  input: { id?: string | null; code?: string | null },
): { event: T } | { error: "missing" | "unavailable" } {
  const code = input.code?.trim().toLowerCase();
  const event =
    (input.id ? events.find((item) => item.id === input.id) : undefined) ??
    (code ? events.find((item) => item.code.toLowerCase() === code) : undefined) ??
    null;
  if (!event) return { error: "missing" };
  if (!eventOpen(event)) return { error: "unavailable" };
  return { event };
}
