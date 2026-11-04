"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen, Search } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { PersonCard } from "@/components/events/person-card";
import type { FieldPerson } from "@/components/signal/signal-field";
import type { DirectoryPerson } from "@/components/signal/use-room";
import { filterPeople, sortDirectory, sortRecommendations, type RailSort } from "@/components/signal/signal-rail-logic";

export type RailStatus = "loading" | "pending" | "ready" | "empty-room" | "no-matches" | "error";

type RailPerson = FieldPerson | DirectoryPerson;

const meta = "font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase";
const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
const easeOut = [0.23, 1, 0.32, 1] as const;

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex animate-pulse items-start gap-3 rounded-[20px] border border-border bg-surface px-4 py-4">
          <span className="size-11 shrink-0 rounded-full bg-surface-raised" />
          <span className="flex flex-1 flex-col gap-2 pt-1">
            <span className="h-2.5 w-2/3 rounded-full bg-surface-raised" />
            <span className="h-2.5 w-1/2 rounded-full bg-surface-raised" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SignalRail({
  recommendations,
  directory,
  selectedId,
  directoryId,
  hoveredId,
  onSelectPerson,
  onSelectDirectory,
  onHover,
  displayName,
  reasonOf,
  recommendationTags,
  directoryTags,
  detail,
  detailLabel,
  onBack,
  collapsed,
  onToggleCollapsed,
  sheetExpanded,
  onToggleSheet,
  status,
  notice,
  onJoinDifferent,
  joinPending,
}: {
  recommendations: FieldPerson[];
  directory: DirectoryPerson[];
  selectedId: string | null;
  directoryId: string | null;
  hoveredId: string | null;
  onSelectPerson: (id: string) => void;
  onSelectDirectory: (id: string) => void;
  onHover: (id: string | null) => void;
  displayName: (person: RailPerson) => string;
  reasonOf: (person: FieldPerson) => string;
  recommendationTags: (person: FieldPerson) => string[];
  directoryTags: (person: DirectoryPerson) => string[];
  detail: ReactNode;
  detailLabel: string | null;
  onBack: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  sheetExpanded: boolean;
  onToggleSheet: () => void;
  status: RailStatus;
  notice: string | null;
  onJoinDifferent: () => void;
  joinPending: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<"top" | "everyone">("top");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RailSort>("best");
  const listRef = useRef<HTMLDivElement | null>(null);

  const memberCount = recommendations.length + directory.length;

  const visibleRecommendations = useMemo(
    () =>
      sortRecommendations(
        filterPeople(recommendations, query, (person) => [displayName(person), person.role, ...recommendationTags(person)]),
        sort,
        displayName,
      ),
    [recommendations, query, sort, displayName, recommendationTags],
  );

  const visibleDirectory = useMemo(
    () =>
      sortDirectory(
        filterPeople(directory, query, (person) => [displayName(person), person.role, ...directoryTags(person)]),
        sort,
        displayName,
      ),
    [directory, query, sort, displayName, directoryTags],
  );

  // Selection made in the 3D field lands here: keep its row in view.
  useEffect(() => {
    if (detail) return;
    const id = selectedId ?? directoryId;
    if (!id) return;
    const row = listRef.current?.querySelector<HTMLElement>(`#rail-person-${CSS.escape(id)}`);
    row?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [selectedId, directoryId, detail, tab, reduceMotion]);

  function onListKeyDown(event: React.KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-rail-row]") ?? []);
    if (rows.length === 0) return;
    const current = rows.indexOf(document.activeElement as HTMLElement);
    let next = current;
    if (event.key === "ArrowDown") next = Math.min(rows.length - 1, current + 1);
    if (event.key === "ArrowUp") next = Math.max(0, current - 1);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = rows.length - 1;
    if (next !== current) {
      event.preventDefault();
      rows[next]?.focus();
    }
  }

  const busy = status === "loading" || status === "pending";

  return (
    <motion.aside
      aria-label="Signals and people"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={{ duration: reduceMotion ? 0.16 : 0.35, ease: easeOut }}
      className={cn(
        "absolute z-20 flex flex-col overflow-hidden rounded-[20px] border border-border bg-surface shadow-[var(--shadow-raise)]",
        "inset-x-3 bottom-3 min-[720px]:inset-x-auto min-[720px]:top-4 min-[720px]:right-4 min-[720px]:bottom-4",
        collapsed ? "min-[720px]:w-14" : "min-[720px]:w-[380px]",
        sheetExpanded ? "h-[62svh] min-[720px]:h-auto" : "h-[12.25rem] min-[720px]:h-auto",
        "transition-[width,height] duration-300 ease-[var(--ease-in-out)] motion-reduce:transition-none",
      )}
    >
      {collapsed ? (
        <div className="hidden h-full flex-col items-center gap-3 py-3 min-[720px]:flex">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Expand people panel"
            className={cn("inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-raised", focusRing)}
          >
            <PanelRightOpen aria-hidden="true" className="size-5" />
          </button>
          <span className={cn(meta, "[writing-mode:vertical-rl]")}>Signals · {memberCount}</span>
          <span aria-hidden="true" className="size-2 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
        </div>
      ) : null}

      {/* Collapsed only exists on desktop: on mobile the sheet always shows. */}
      <div className={cn("flex min-h-0 flex-1 flex-col", collapsed && "min-[720px]:hidden")}>
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="flex items-center gap-2 font-heading text-[1.4rem] leading-none tracking-[-0.02em]">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
                Your signals
              </h2>
              <p className={meta} aria-live="polite">
                {status === "pending"
                  ? "Finding your people…"
                  : status === "loading"
                    ? "Loading the room…"
                    : `${memberCount} in the room`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onToggleSheet}
                aria-expanded={sheetExpanded}
                aria-label={sheetExpanded ? "Collapse people sheet" : "Expand people sheet"}
                className={cn("inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-raised min-[720px]:hidden", focusRing)}
              >
                {sheetExpanded ? <ChevronDown aria-hidden="true" className="size-5" /> : <ChevronUp aria-hidden="true" className="size-5" />}
              </button>
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label="Collapse people panel"
                className={cn("hidden size-11 items-center justify-center rounded-full hover:bg-surface-raised min-[720px]:inline-flex", focusRing)}
              >
                <PanelRightClose aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {detail ? (
              <motion.div
                key={detailLabel ?? "detail"}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                transition={{ duration: reduceMotion ? 0.16 : 0.28, ease: easeOut }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="shrink-0 px-4 pb-2">
                  <Button type="button" variant="ghost" className={cn("h-11 min-[720px]:h-9", focusRing)} onClick={onBack}>
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    Back to signals
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{detail}</div>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
                transition={{ duration: reduceMotion ? 0.16 : 0.28, ease: easeOut }}
                className={cn("flex min-h-0 flex-1 flex-col", !sheetExpanded && "max-[719px]:hidden")}
              >
                <div className="flex shrink-0 flex-col gap-3 px-4 pb-3">
                  <div className="flex rounded-full border border-border bg-background p-1" role="tablist" aria-label="People filter">
                    {(
                      [
                        { id: "top", label: `Top matches · ${recommendations.length}` },
                        { id: "everyone", label: `Everyone · ${directory.length}` },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        onClick={() => setTab(item.id)}
                        className={cn(
                          "min-h-9 flex-1 rounded-full px-2 font-mono text-[0.65rem] tracking-[0.06em] uppercase transition-colors duration-200 motion-reduce:transition-none",
                          tab === item.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                          focusRing,
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative min-w-0 flex-1">
                      <span className="sr-only">Search people</span>
                      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search name, role, tag…"
                        className={cn(
                          "h-11 w-full rounded-full border border-border bg-background pr-3 pl-9 text-base text-foreground min-[720px]:h-9 min-[720px]:text-sm",
                          focusRing,
                        )}
                      />
                    </label>
                    <label className="shrink-0">
                      <span className="sr-only">Sort people</span>
                      <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value === "az" ? "az" : "best")}
                        className={cn("h-11 rounded-full border border-border bg-background px-2 text-sm min-[720px]:h-9", focusRing)}
                      >
                        <option value="best">Best match</option>
                        <option value="az">A–Z</option>
                      </select>
                    </label>
                  </div>
                  {notice ? (
                    <p role="status" className="text-sm text-muted-foreground">
                      {notice}
                    </p>
                  ) : null}
                </div>

                <div ref={listRef} onKeyDown={onListKeyDown} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                  {busy ? (
                    <>
                      <SkeletonRows />
                      <p role="status" className="sr-only">
                        {status === "pending" ? "Finding your people." : "Loading the room."}
                      </p>
                    </>
                  ) : tab === "top" ? (
                    visibleRecommendations.length > 0 ? (
                      <ul className="flex flex-col gap-3" aria-label="Recommended people">
                        {visibleRecommendations.map((person, index) => (
                          <motion.li
                            key={person.id}
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: reduceMotion ? 0.16 : 0.28, delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03, ease: easeOut }}
                          >
                            <PersonCard
                              elementId={`rail-person-${person.id}`}
                              name={displayName(person)}
                              role={person.role}
                              slug={person.slug}
                              demo={person.demo}
                              reason={reasonOf(person)}
                              tags={recommendationTags(person)}
                              rank={index + 1}
                              confidence={person.recommendation?.confidence ?? null}
                              selected={selectedId === person.id}
                              active={hoveredId === person.id}
                              onSelect={() => onSelectPerson(person.id)}
                              onHoverChange={(hovered) => onHover(hovered ? person.id : null)}
                            />
                          </motion.li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex flex-col items-start gap-3 py-2">
                        <p className="max-w-[40ch] text-sm text-muted-foreground">
                          {query.trim()
                            ? `No one matches “${query.trim()}”.`
                            : status === "empty-room"
                              ? "You're the first one here. Share the event link and this room fills up as people register."
                              : status === "error"
                                ? "Could not refresh. Try again above."
                                : "No close matches yet — everyone going is under Everyone."}
                        </p>
                        {status === "empty-room" || status === "no-matches" ? (
                          <Button type="button" disabled={joinPending} onClick={onJoinDifferent}>
                            {joinPending ? "Leaving…" : "Join a different event"}
                          </Button>
                        ) : null}
                      </div>
                    )
                  ) : visibleDirectory.length > 0 ? (
                    <ul className="flex flex-col gap-2.5" aria-label="Everyone going">
                      {visibleDirectory.map((person, index) => (
                        <motion.li
                          key={person.id}
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: reduceMotion ? 0.16 : 0.28, delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03, ease: easeOut }}
                        >
                          <PersonCard
                            elementId={`rail-person-${person.id}`}
                            name={displayName(person)}
                            role={person.role}
                            slug={person.slug}
                            demo={person.demo}
                            tags={directoryTags(person)}
                            compact
                            selected={directoryId === person.id}
                            active={hoveredId === person.id}
                            onSelect={() => onSelectDirectory(person.id)}
                            onHoverChange={(hovered) => onHover(hovered ? person.id : null)}
                          />
                        </motion.li>
                      ))}
                    </ul>
                  ) : (
                    <p className="max-w-[40ch] py-2 text-sm text-muted-foreground">
                      {query.trim() ? `No one matches “${query.trim()}”.` : "No one else here yet."}
                    </p>
                  )}
                  <p aria-live="polite" className="sr-only">
                    {tab === "top" ? `${visibleRecommendations.length} recommendations shown.` : `${visibleDirectory.length} people shown.`}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>
    </motion.aside>
  );
}
