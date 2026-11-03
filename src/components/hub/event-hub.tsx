"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export type HubEvent = {
  id: string;
  name: string;
  demo: boolean;
  description: string;
  category: string;
  startsAt: string | null;
  code: string;
  status: string;
  attendees?: number;
};

export type MyEventItem = {
  eventId: string;
  status: string;
  joinedAt?: string | null;
  presence: "active" | null;
  event: HubEvent;
};

const meta = "font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";
const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
const field = cn(
  "min-h-11 w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-base text-foreground min-[720px]:text-[0.9375rem]",
  focusRing,
);

function eventMeta(event: HubEvent): string {
  const parts: string[] = [];
  if (event.category) parts.push(event.category);
  if (event.startsAt) {
    const date = new Date(event.startsAt);
    if (!Number.isNaN(date.getTime())) {
      parts.push(date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }));
    }
  }
  if (typeof event.attendees === "number") parts.push(`${event.attendees} here`);
  return parts.join(" · ");
}

function JoinForm({
  event,
  onDone,
}: {
  event: HubEvent;
  onDone: (eventId: string) => void;
}) {
  const router = useRouter();
  const [intent, setIntent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/participation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: event.id, intent: intent.trim() }),
      });
      if (!response.ok) throw new Error("join");
      onDone(event.id);
      router.push(`/events/${event.id}`);
    } catch {
      setError("Could not join this event. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 pt-3" aria-label={`Join ${event.name}`}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`intent-${event.id}`} className={meta}>
          What do you want from this event? (optional)
        </label>
        <textarea
          id={`intent-${event.id}`}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={3}
          maxLength={500}
          className={field}
          placeholder="Meet people working on…"
        />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Joining makes you visible to others at this event.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending} className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto">
          {pending ? "Joining…" : "Join event"}
        </Button>
      </div>
    </form>
  );
}

function EventRow({
  event,
  joined,
  expanded,
  onToggleJoin,
  onJoined,
}: {
  event: HubEvent;
  joined: boolean;
  expanded: boolean;
  onToggleJoin: (event: HubEvent) => void;
  onJoined: (eventId: string) => void;
}) {
  const metaText = eventMeta(event);
  return (
    <li className="py-4 first:pt-1 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 font-heading text-xl leading-tight tracking-[-0.01em]">
            {event.name}
            {event.demo ? (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                Demo
              </span>
            ) : null}
          </p>
          {metaText ? <p className={meta}>{metaText}</p> : null}
          {event.description ? (
            <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">{event.description}</p>
          ) : null}
        </div>
        {joined ? (
          <Link
            href={`/events/${event.id}`}
            className={cn(
              "inline-flex h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-transform duration-200 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none min-[720px]:h-9",
              focusRing,
            )}
          >
            Open
          </Link>
        ) : (
          <Button
            type="button"
            variant={expanded ? "ghost" : "default"}
            className="h-11 min-[720px]:h-9"
            aria-expanded={expanded}
            onClick={() => onToggleJoin(event)}
          >
            {expanded ? "Cancel" : "Join"}
          </Button>
        )}
      </div>
      {!joined && expanded ? <JoinForm event={event} onDone={onJoined} /> : null}
    </li>
  );
}

function EventHubInner({
  myEvents,
  initialEvents,
  canCreateEvent,
  identityName,
}: {
  myEvents: MyEventItem[];
  initialEvents: HubEvent[];
  canCreateEvent: boolean;
  identityName: string;
}) {
  const searchParams = useSearchParams();
  const [joinedIds, setJoinedIds] = useState<Set<string>>(() => new Set(myEvents.map((item) => item.eventId)));
  const [searchedEvents, setSearchedEvents] = useState<HubEvent[] | null>(null);
  const [createdEvents, setCreatedEvents] = useState<HubEvent[]>([]);
  const searchTimer = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const baseEvents = [...createdEvents, ...initialEvents.filter((item) => !createdEvents.some((created) => created.id === item.id))];
  const events = query.trim() ? (searchedEvents ?? []) : baseEvents;
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [resolved, setResolved] = useState<HubEvent | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codePending, setCodePending] = useState(false);
  const codeAttempted = useRef<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCategory, setCreateCategory] = useState("");
  const [createStartsAt, setCreateStartsAt] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const joinedEvents = useMemo(
    () => myEvents.filter((item) => joinedIds.has(item.eventId)),
    [myEvents, joinedIds],
  );
  const currentMine = joinedEvents.filter((item) => item.event.status !== "ended" && item.status !== "ended");
  const pastMine = joinedEvents.filter((item) => item.event.status === "ended" || item.status === "ended");

  function handleQueryChange(value: string) {
    setQuery(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (!value.trim()) {
      setSearchedEvents(null);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    searchTimer.current = window.setTimeout(() => {
      void fetch(`/api/events?q=${encodeURIComponent(value.trim())}`)
        .then(async (response) => {
          const body = (await response.json()) as { events?: HubEvent[] };
          if (!response.ok) throw new Error("search");
          setSearchedEvents(Array.isArray(body.events) ? body.events : []);
          setSearchError(null);
        })
        .catch(() => setSearchError("Could not search events. Try again."))
        .finally(() => setSearching(false));
    }, 300);
  }

  const resolveCode = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setCodePending(true);
    setCodeError(null);
    try {
      const response = await fetch(`/api/events?code=${encodeURIComponent(trimmed)}`);
      const body = (await response.json()) as { event?: HubEvent; error?: string };
      if (!response.ok || !body.event) {
        setResolved(null);
        setCodeError(response.status === 410 ? "That event has ended." : "No event found for that code or link.");
        return;
      }
      setResolved(body.event);
      if (joinedIds.has(body.event.id)) setExpandedId(null);
    } catch {
      setCodeError("Could not look up that code. Try again.");
    } finally {
      setCodePending(false);
    }
  }, [joinedIds]);

  // Clear a pending debounced search on unmount.
  useEffect(
    () => () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    },
    [],
  );

  useEffect(() => {
    const fromUrl = searchParams.get("code");
    if (fromUrl && codeAttempted.current !== fromUrl) {
      codeAttempted.current = fromUrl;
      setCode(fromUrl);
      void resolveCode(fromUrl);
    }
  }, [searchParams, resolveCode]);

  function toggleJoin(event: HubEvent) {
    setExpandedId((current) => (current === event.id ? null : event.id));
  }

  function markJoined(eventId: string) {
    setJoinedIds((current) => new Set(current).add(eventId));
  }

  async function createEvent(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (createPending) return;
    setCreatePending(true);
    setCreateError(null);
    setCreateMessage(null);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim(),
          category: createCategory.trim(),
          startsAt: createStartsAt ? new Date(createStartsAt).toISOString() : null,
        }),
      });
      const body = (await response.json()) as { event?: HubEvent; error?: string };
      if (!response.ok || !body.event) throw new Error("create");
      setCreatedEvents((current) => [body.event as HubEvent, ...current.filter((item) => item.id !== body.event?.id)]);
      setSearchedEvents((current) => (current ? [body.event as HubEvent, ...current.filter((item) => item.id !== body.event?.id)] : current));
      setExpandedId(body.event.id);
      setCreateMessage("Event created. Join it to open the room.");
      setCreateName("");
      setCreateDescription("");
      setCreateCategory("");
      setCreateStartsAt("");
    } catch {
      setCreateError("Could not create the event. Check the name and try again.");
    } finally {
      setCreatePending(false);
    }
  }

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance min-[720px]:text-[3.25rem]">
          Events
        </h1>
        <p className="max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
          {identityName ? `Signed in as ${identityName}. ` : ""}Pick a room to enter, or join a new one.
        </p>
      </div>

      <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="My events">
        <h2 className={meta}>My events</h2>
        {currentMine.length === 0 ? (
          <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
            You have not joined an event yet. Find one below.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {currentMine.map((item) => (
              <li key={item.eventId} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-1 last:pb-0">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 font-heading text-xl leading-tight tracking-[-0.01em]">
                    {item.event.name}
                    {item.event.demo ? (
                      <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                        Demo
                      </span>
                    ) : null}
                  </p>
                  <p className={meta}>{eventMeta(item.event) || item.event.status}</p>
                  {item.presence ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-[var(--signal-strong)] dark:bg-signal"
                      />
                      Live now
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/events/${item.eventId}`}
                  className={cn(
                    "inline-flex h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-transform duration-200 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none min-[720px]:h-9",
                    focusRing,
                  )}
                >
                  Open event
                </Link>
              </li>
            ))}
          </ul>
        )}
        {pastMine.length > 0 ? (
          <div className="flex flex-col gap-3 pt-4">
            <h3 className={meta}>Past events</h3>
            <ul className="flex flex-col divide-y divide-border">
              {pastMine.map((item) => (
                <li key={item.eventId} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-1 last:pb-0">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-heading text-xl leading-tight tracking-[-0.01em]">{item.event.name}</p>
                    <p className={meta}>{eventMeta(item.event) || "Ended"}</p>
                  </div>
                  <span className={meta}>Ended</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Discover events">
        <h2 className={meta}>Discover events</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="event-search" className={meta}>Search events</label>
          <input
            id="event-search"
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by name, topic, or code"
            className={field}
          />
        </div>
        {searching ? (
          <p role="status" className="text-sm text-muted-foreground">Searching…</p>
        ) : null}
        {searchError ? (
          <p role="alert" className="text-sm text-destructive">{searchError}</p>
        ) : null}
        {!searching && events.length === 0 ? (
          <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">No events match. Try another search.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                joined={joinedIds.has(event.id)}
                expanded={expandedId === event.id}
                onToggleJoin={toggleJoin}
                onJoined={markJoined}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Join with a code or link">
        <h2 className={meta}>Join with a code or link</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void resolveCode(code);
          }}
          className="flex flex-col gap-2 min-[720px]:flex-row"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="event-code" className="sr-only">Event code or link</label>
            <input
              id="event-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Event code"
              className={field}
            />
          </div>
          <Button type="submit" disabled={codePending || !code.trim()} className="h-11 min-[720px]:h-9">
            {codePending ? "Looking up…" : "Find event"}
          </Button>
        </form>
        {codeError ? (
          <p role="alert" className="text-sm text-destructive">{codeError}</p>
        ) : null}
        {resolved ? (
          <ul className="flex flex-col divide-y divide-border">
            <EventRow
              event={resolved}
              joined={joinedIds.has(resolved.id)}
              expanded={expandedId === resolved.id}
              onToggleJoin={toggleJoin}
              onJoined={markJoined}
            />
          </ul>
        ) : null}
      </section>

      {canCreateEvent ? (
        <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Create an event">
          <h2 className={meta}>Create an event</h2>
          <form onSubmit={(e) => void createEvent(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-name" className={meta}>Name</label>
              <input id="create-name" value={createName} onChange={(e) => setCreateName(e.target.value)} required minLength={2} maxLength={80} className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-description" className={meta}>Description (optional)</label>
              <textarea id="create-description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={3} maxLength={400} className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-category" className={meta}>Category (optional)</label>
              <input id="create-category" value={createCategory} onChange={(e) => setCreateCategory(e.target.value)} maxLength={40} className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-starts" className={meta}>Starts at (optional)</label>
              <input id="create-starts" type="datetime-local" value={createStartsAt} onChange={(e) => setCreateStartsAt(e.target.value)} className={field} />
            </div>
            {createError ? (
              <p role="alert" className="text-sm text-destructive">{createError}</p>
            ) : null}
            {createMessage ? (
              <p role="status" className="text-sm text-muted-foreground">{createMessage}</p>
            ) : null}
            <div>
              <Button type="submit" disabled={createPending} className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto">
                {createPending ? "Creating…" : "Create event"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

export function EventHub(props: {
  myEvents: MyEventItem[];
  initialEvents: HubEvent[];
  canCreateEvent: boolean;
  identityName: string;
}) {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading events…</p>}>
      <EventHubInner {...props} />
    </Suspense>
  );
}
