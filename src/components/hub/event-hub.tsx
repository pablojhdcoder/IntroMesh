"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { EventCard, type EventCardEvent } from "@/components/events/event-card";
import { EventPicker } from "@/components/events/event-picker";

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
  memberCount?: number;
  event: HubEvent;
};

const meta = "font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";
const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
const field = cn(
  "min-h-11 w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-base text-foreground min-[720px]:text-[0.9375rem]",
  focusRing,
);

function toCardEvent(event: HubEvent, memberCount?: number): EventCardEvent {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    category: event.category,
    startsAt: event.startsAt,
    status: event.status,
    demo: event.demo,
    attendees: typeof memberCount === "number" ? memberCount : event.attendees,
  };
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
        Joining registers you for this event.
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

function EventHubInner({
  myEvents,
  initialEvents,
  canCreateEvent,
}: {
  myEvents: MyEventItem[];
  initialEvents: HubEvent[];
  canCreateEvent: boolean;
}) {
  const searchParams = useSearchParams();
  const [joinedIds, setJoinedIds] = useState<Set<string>>(() => new Set(myEvents.map((item) => item.eventId)));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const codeAttempted = useRef<string | null>(null);

  const baseEvents = initialEvents;

  const joinedEvents = useMemo(
    () => myEvents.filter((item) => joinedIds.has(item.eventId)),
    [myEvents, joinedIds],
  );
  const currentMine = joinedEvents.filter((item) => item.event.status !== "ended" && item.status !== "ended");
  const pastMine = joinedEvents.filter((item) => item.event.status === "ended" || item.status === "ended");

  useEffect(() => {
    const fromUrl = searchParams.get("code");
    if (fromUrl && codeAttempted.current !== fromUrl) {
      codeAttempted.current = fromUrl;
      setCode(fromUrl);
    }
  }, [searchParams]);

  function toggleJoin(event: EventCardEvent) {
    const full = baseEvents.find((item) => item.id === event.id) ?? {
      id: event.id,
      name: event.name,
      demo: event.demo ?? false,
      description: event.description ?? "",
      category: event.category ?? "",
      startsAt: event.startsAt ?? null,
      code: "",
      status: event.status,
      attendees: event.attendees,
    };
    setExpandedId((current) => (current === full.id ? null : full.id));
  }

  function markJoined(eventId: string) {
    setJoinedIds((current) => new Set(current).add(eventId));
    setExpandedId(null);
  }

  const expandedEvent = expandedId ? baseEvents.find((item) => item.id === expandedId) ?? null : null;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance min-[720px]:text-[3.25rem]">
          Events
        </h1>
        <p className="max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
          Pick a room to enter, or join a new one.
        </p>
      </div>

      <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="My events">
        <h2 className={meta}>My events</h2>
        {currentMine.length === 0 ? (
          <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
            You have not joined an event yet. Find one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {currentMine.map((item) => (
              <li key={item.eventId}>
                <EventCard
                  event={toCardEvent(item.event, item.memberCount)}
                  joined
                  action={
                    <Link
                      href={`/events/${item.eventId}`}
                      className={cn(
                        "inline-flex h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-transform duration-200 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none min-[720px]:h-9 min-[720px]:w-auto",
                        focusRing,
                      )}
                    >
                      Open
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {pastMine.length > 0 ? (
          <div className="flex flex-col gap-3 pt-4">
            <h3 className={meta}>Past events</h3>
            <ul className="flex flex-col gap-3">
              {pastMine.map((item) => (
                <li key={item.eventId}>
                  <EventCard event={toCardEvent(item.event, item.memberCount)} joined />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Discover events">
        <h2 className={meta}>Discover</h2>
        <EventPicker
          events={baseEvents.map((event) => toCardEvent(event))}
          onPick={toggleJoin}
          canCreateEvent={canCreateEvent}
          selectedId={expandedId}
          pickLabel="Join"
        />
        {expandedEvent && !joinedIds.has(expandedEvent.id) ? (
          <JoinForm event={expandedEvent} onDone={markJoined} />
        ) : null}
        {code ? <p className="sr-only">Shared link code: {code}</p> : null}
      </section>
    </div>
  );
}

export function EventHub(props: {
  myEvents: MyEventItem[];
  initialEvents: HubEvent[];
  canCreateEvent: boolean;
}) {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading events…</p>}>
      <EventHubInner {...props} />
    </Suspense>
  );
}
