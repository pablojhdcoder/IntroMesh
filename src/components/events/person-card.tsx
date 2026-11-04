"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "cn";

export type PersonCardProps = {
  name: string;
  role: string;
  slug: string;
  demo?: boolean;
  reason?: string | null;
  tags?: string[];
  selected?: boolean;
  /** Hover/focus sync with the 3D field: same highlight, no selection change. */
  active?: boolean;
  /** 1-based position in the recommendation ranking. */
  rank?: number;
  confidence?: "low" | "medium" | "high" | null;
  compact?: boolean;
  elementId?: string;
  onSelect?: (slug: string) => void;
  onHoverChange?: (hovered: boolean) => void;
};

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const chipClass = "inline-flex items-center rounded-full border border-border px-3 py-1 text-sm";

function initialsOf(name: string): string {
  return (
    name
      .replace(/^@/, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

const CONFIDENCE_LABEL = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;

export function PersonCard({
  name,
  role,
  slug,
  demo,
  reason,
  tags,
  selected,
  active,
  rank,
  confidence,
  compact,
  elementId,
  onSelect,
  onHoverChange,
}: PersonCardProps) {
  const shownTags = (tags ?? []).slice(0, compact ? 1 : 2);
  const highlighted = Boolean(selected || active);
  const content = (
    <>
      {/* Signal rail: selection is a bar, hover a whisper of the same accent. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-3 left-0 w-[3px] rounded-full transition-[background-color,opacity] duration-200 motion-reduce:transition-none",
          selected ? "bg-[var(--signal-vivid)] dark:bg-signal" : active ? "bg-[var(--signal-vivid)]/40 dark:bg-signal/40" : "bg-transparent",
        )}
      />
      <span className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-signal font-heading text-[#14160c] transition-shadow duration-200 motion-reduce:transition-none",
            compact ? "size-9 text-base" : "size-11 text-lg",
            selected
              ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--signal-vivid)] dark:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--signal)]"
              : active
                ? "shadow-[0_0_0_2px_var(--surface),0_0_0_3px_var(--border)]"
                : "",
          )}
        >
          {initialsOf(name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate font-medium underline-offset-4 group-hover:underline">
              {name}
              {demo ? <span className="font-normal text-muted-foreground"> · Demo</span> : null}
            </span>
            {rank ? (
              <span aria-hidden="true" className="shrink-0 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground">
                #{rank}
              </span>
            ) : null}
          </span>
          {role ? <span className="truncate text-muted-foreground">{role}</span> : null}
          {reason ? <span className="truncate text-foreground">{reason}</span> : null}
          {confidence ? (
            <span className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  confidence === "high"
                    ? "bg-[var(--signal-vivid)] dark:bg-signal"
                    : confidence === "medium"
                      ? "bg-foreground/60"
                      : "border border-muted-foreground bg-transparent",
                )}
              />
              {CONFIDENCE_LABEL[confidence]}
            </span>
          ) : null}
        </span>
        {onSelect ? (
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "mt-1 size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none",
              highlighted && "translate-x-0.5 text-foreground",
            )}
          />
        ) : null}
      </span>
      {shownTags.length > 0 ? (
        <span className={cn("flex flex-wrap gap-1.5", compact ? "pl-12" : "pl-14")}>
          {shownTags.map((tag) => (
            <span key={`${slug}-${tag}`} className={cn(chipClass, "px-2.5 py-0.5 text-[0.8125rem]")}>
              {tag}
            </span>
          ))}
        </span>
      ) : null}
    </>
  );

  const sharedClass = cn(
    "group relative flex min-h-11 w-full flex-col justify-center gap-1.5 overflow-hidden rounded-[20px] border text-left text-sm transition-[border-color,background-color,box-shadow,transform] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none",
    compact ? "px-3.5 py-3 pl-4" : "px-4 py-4 pl-[1.125rem]",
    onSelect && "hover:-translate-y-px motion-reduce:hover:translate-y-0",
    selected
      ? "border-foreground/40 bg-surface-raised shadow-[var(--shadow-raise)]"
      : "border-border bg-surface shadow-[var(--shadow-raise)] hover:border-foreground/30",
    active && !selected && "border-foreground/30 bg-surface-raised/60",
  );

  if (onSelect) {
    return (
      <button
        type="button"
        id={elementId}
        data-rail-row="true"
        onClick={() => onSelect(slug)}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
        onFocus={() => onHoverChange?.(true)}
        onBlur={() => onHoverChange?.(false)}
        aria-label={`${name}, ${role}${demo ? ", demo profile" : ""}${reason ? `. ${reason}` : ""}`}
        aria-pressed={selected ?? undefined}
        className={cn(sharedClass, focusRing)}
      >
        {content}
      </button>
    );
  }

  return (
    <div id={elementId} className={sharedClass}>
      {content}
    </div>
  );
}
