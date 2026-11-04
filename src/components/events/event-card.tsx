"use client";

import type { ReactNode } from "react";
import { cn } from "cn";

export type EventCardEvent = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  startsAt?: string | null;
  status: string;
  demo?: boolean;
  attendees?: number;
};

export type EventCardProps = {
  event: EventCardEvent;
  joined?: boolean;
  action?: ReactNode;
};

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function formatEventDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function EventCard({ event, joined, action }: EventCardProps) {
  const dateLabel = formatEventDate(event.startsAt ?? null);
  const metaParts = [event.category, dateLabel].filter(Boolean).join(" · ");
  const attendeesLabel =
    typeof event.attendees === "number" ? `${event.attendees} going` : null;

  return (
    <article
      className={cn(
        "flex w-full flex-col gap-3 rounded-[20px] border border-border bg-surface px-4 py-4 shadow-[var(--shadow-raise)] transition-[border-color,background-color,box-shadow,transform] duration-200 ease-[var(--ease-out)] hover:-translate-y-px hover:border-foreground/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-signal font-heading text-lg text-[#14160c]"
          >
            {initialsOf(event.name)}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-heading text-xl leading-tight text-foreground">{event.name}</span>
            <span className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
              {[metaParts, attendeesLabel].filter(Boolean).join(" · ") || event.status}
            </span>
          </span>
        </div>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-0.5">
          {event.status === "live" ? (
            <span className="flex items-center gap-1.5 font-mono text-[0.65rem] font-medium tracking-[0.08em] text-foreground uppercase">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
              Live
            </span>
          ) : (
            <span className="font-mono text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {event.status}
            </span>
          )}
          {event.demo ? (
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Demo
            </span>
          ) : null}
          {joined ? (
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Joined
            </span>
          ) : null}
        </span>
      </div>
      {event.description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{event.description}</p>
      ) : null}
      {action ? <div className="flex flex-col gap-2">{action}</div> : null}
      <span className={cn("sr-only", focusRing)} />
    </article>
  );
}
