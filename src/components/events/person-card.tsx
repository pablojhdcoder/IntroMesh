"use client";

import { cn } from "cn";

export type PersonCardProps = {
  name: string;
  role: string;
  slug: string;
  demo?: boolean;
  reason?: string | null;
  tags?: string[];
  selected?: boolean;
  onSelect?: (slug: string) => void;
};

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const chipClass = "inline-flex items-center rounded-full border border-border px-3 py-1 text-sm";

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

export function PersonCard({ name, role, slug, demo, reason, tags, selected, onSelect }: PersonCardProps) {
  const shownTags = (tags ?? []).slice(0, 2);
  const content = (
    <>
      <span className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-signal font-heading text-lg text-[#14160c]"
        >
          {initialsOf(name)}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium underline-offset-4 group-hover:underline">
            {name}
            {demo ? <span className="font-normal text-muted-foreground"> · Demo</span> : null}
          </span>
          {role ? <span className="truncate text-muted-foreground">{role}</span> : null}
          {reason ? <span className="truncate text-foreground">{reason}</span> : null}
        </span>
      </span>
      {shownTags.length > 0 ? (
        <span className="flex flex-wrap gap-1.5 pl-14">
          {shownTags.map((tag) => (
            <span key={`${slug}-${tag}`} className={cn(chipClass, "px-2.5 py-0.5 text-[0.8125rem]")}>
              {tag}
            </span>
          ))}
        </span>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(slug)}
        aria-label={`${name}, ${role}${demo ? ", demo profile" : ""}${reason ? `. ${reason}` : ""}`}
        aria-pressed={selected ?? undefined}
        className={cn(
          "group flex min-h-11 w-full flex-col justify-center gap-1.5 rounded-[20px] border border-border bg-surface px-4 py-4 text-left text-sm shadow-[var(--shadow-raise)] transition-[border-color,background-color,box-shadow,transform] duration-200 ease-[var(--ease-out)] hover:-translate-y-px hover:border-foreground/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          selected && "border-foreground/40 bg-surface-raised",
          focusRing,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "group flex min-h-11 w-full flex-col justify-center gap-1.5 rounded-[20px] border border-border bg-surface px-4 py-4 text-left text-sm shadow-[var(--shadow-raise)]",
        selected && "border-foreground/40 bg-surface-raised",
      )}
    >
      {content}
    </div>
  );
}
