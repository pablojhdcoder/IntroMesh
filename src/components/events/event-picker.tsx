"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard, type EventCardEvent } from "@/components/events/event-card";
import { cn } from "cn";

export type { EventCardEvent };

export type EventPickerProps = {
  events: EventCardEvent[];
  onPick: (event: EventCardEvent) => void;
  canCreateEvent: boolean;
  selectedId?: string | null;
  pickLabel?: string;
};

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
const fieldInput =
  "h-11 rounded-[12px] border border-border bg-surface px-3.5 font-sans text-[1rem] text-foreground transition-colors hover:border-foreground/25 motion-reduce:transition-none";
const meta = "font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";

export function extractInviteCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : null;
  if (withProtocol) {
    try {
      const url = new URL(withProtocol);
      const fromParams =
        url.searchParams.get("code") ?? url.searchParams.get("event") ?? url.searchParams.get("invite");
      if (fromParams?.trim()) return fromParams.trim();
    } catch {
      // Fall through to plain-code handling below.
    }
  }
  const queryMatch = trimmed.match(/[?&](?:code|event|invite)=([^&\s#]+)/i);
  if (queryMatch?.[1]) {
    try {
      return decodeURIComponent(queryMatch[1]).trim();
    } catch {
      return queryMatch[1].trim();
    }
  }
  return trimmed;
}

export function EventPicker({ events, onPick, canCreateEvent, selectedId, pickLabel = "Choose" }: EventPickerProps) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<EventCardEvent[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [resolved, setResolved] = useState<EventCardEvent | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codePending, setCodePending] = useState(false);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", category: "", startsAt: "" });
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const visible = query.trim() ? (searched ?? []) : events;

  function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setSearched(null);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
  }

  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/events?q=${encodeURIComponent(query.trim())}`)
        .then(async (response) => {
          const body = (await response.json()) as { events?: EventCardEvent[] };
          if (!response.ok) throw new Error("search");
          setSearched(Array.isArray(body.events) ? body.events : []);
          setSearchError(null);
        })
        .catch(() => setSearchError("Could not search events. Try again."))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function findByCode() {
    const trimmed = extractInviteCode(code);
    if (!trimmed) return;
    setCodePending(true);
    setCodeError(null);
    try {
      const response = await fetch(`/api/events?code=${encodeURIComponent(trimmed)}`);
      const body = (await response.json()) as { event?: EventCardEvent; error?: string };
      if (!response.ok || !body.event) {
        setResolved(null);
        setCodeError(response.status === 410 ? "This event is no longer available." : "I cannot find that code.");
        return;
      }
      setResolved(body.event);
    } catch {
      setCodeError("I cannot find that code.");
    } finally {
      setCodePending(false);
    }
  }

  async function createEvent() {
    if (createPending) return;
    setCreatePending(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, startsAt: draft.startsAt || null }),
      });
      const body = (await response.json()) as { event?: EventCardEvent };
      if (!response.ok || !body.event) throw new Error("create");
      onPick(body.event);
    } catch {
      setCreateError("Could not create the event.");
    } finally {
      setCreatePending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {actionError ? (
        <p role="alert" className="rounded-[8px] bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <label htmlFor="event-picker-search" className={meta}>
          Search events
        </label>
        <input
          id="event-picker-search"
          type="search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Search by name, topic, or code"
          className={cn(fieldInput, "min-h-11 w-full", focusRing)}
        />
        {searching ? (
          <p role="status" className="text-sm text-muted-foreground">
            Searching…
          </p>
        ) : null}
        {searchError ? (
          <p role="alert" className="text-sm text-destructive">
            {searchError}
          </p>
        ) : null}
      </div>

      {!searching && visible.length === 0 ? (
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">No events match. Try another search.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Events">
          {visible.map((event) => {
            const isSelected = selectedId === event.id;
            return (
              <li key={event.id}>
                <EventCard
                  event={event}
                  joined={isSelected}
                  action={
                    <Button
                      type="button"
                      variant={isSelected ? "ghost" : "default"}
                      className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto"
                      aria-pressed={isSelected}
                      onClick={() => {
                        try {
                          onPick(event);
                        } catch {
                          setActionError("Could not choose that event. Try again.");
                        }
                      }}
                    >
                      {isSelected ? "Selected" : pickLabel}
                    </Button>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <label htmlFor="event-picker-code" className={meta}>
          Have a code or invite link?
        </label>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ask the organizer for the event code, or paste the full invite link — we detect the code automatically.
        </p>
        <div className="flex flex-col gap-2 min-[720px]:flex-row">
          <input
            id="event-picker-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Paste code or full invite link — e.g. NOVA-42"
            className={cn(fieldInput, "min-h-11 flex-1", focusRing)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto"
            disabled={codePending || code.trim().length === 0}
            onClick={() => void findByCode()}
          >
            {codePending ? "Looking up…" : "Join with code"}
          </Button>
        </div>
        {codeError ? (
          <p role="alert" className="text-sm text-destructive">
            {codeError}
          </p>
        ) : null}
        {resolved ? (
          <EventCard
            event={resolved}
            action={
              <Button
                type="button"
                className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto"
                onClick={() => onPick(resolved)}
              >
                {pickLabel}
              </Button>
            }
          />
        ) : null}
      </div>

      {canCreateEvent ? (
        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <button
            type="button"
            aria-expanded={creating}
            className={cn(
              "flex min-h-11 items-center gap-2 self-start text-sm text-foreground underline-offset-4 transition-colors hover:text-muted-foreground min-[720px]:min-h-9",
              focusRing,
            )}
            onClick={() => setCreating((value) => !value)}
          >
            <Plus aria-hidden="true" className="size-4" />
            Create an event
          </button>
          {creating ? (
            <div className="flex flex-col gap-4">
              <label className={cn("flex flex-col gap-2", meta)}>
                Name
                <input
                  className={cn(fieldInput, focusRing)}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                />
              </label>
              <label className={cn("flex flex-col gap-2", meta)}>
                Description
                <textarea
                  className={cn(fieldInput, "min-h-36 py-3 leading-relaxed", focusRing)}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </label>
              <label className={cn("flex flex-col gap-2", meta)}>
                Category
                <input
                  className={cn(fieldInput, focusRing)}
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                />
              </label>
              <label className={cn("flex flex-col gap-2", meta)}>
                Date
                <input
                  className={cn(fieldInput, focusRing)}
                  type="date"
                  value={draft.startsAt}
                  onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
                />
              </label>
              {createError ? (
                <p role="alert" className="text-sm text-destructive">
                  {createError}
                </p>
              ) : null}
              <Button
                type="button"
                className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto"
                disabled={createPending}
                onClick={() => void createEvent()}
              >
                {createPending ? "Creating…" : "Create event"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
