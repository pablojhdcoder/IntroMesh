"use client";

import dynamic from "next/dynamic";
import { useMemo, useSyncExternalStore } from "react";
import { compactSelection, MOBILE_BREAKPOINT } from "@/components/signal/signal-field-layout";

const SignalGalaxy = dynamic(() => import("@/components/signal/signal-galaxy").then((mod) => mod.SignalGalaxy), {
  ssr: false,
});

export const FIELD_SELF_ID = "__origin";

export type FieldPerson = {
  id: string;
  slug: string;
  displayName: string;
  role: string;
  demo: boolean;
  x: number;
  y: number;
  interests: string[];
  skills: string[];
  recommendation: {
    score: number;
    confidence: "low" | "medium" | "high";
    shared: { goals: string[]; interests: string[]; skills: string[] };
    complement: string[];
  } | null;
};

function subscribeMedia(query: string) {
  return (notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  };
}

const compactQuery = `(max-width: ${MOBILE_BREAKPOINT - 0.02}px)`;
const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeCompact = subscribeMedia(compactQuery);
const subscribeMotion = subscribeMedia(motionQuery);
const readCompact = () => window.matchMedia(compactQuery).matches;
const readMotion = () => window.matchMedia(motionQuery).matches;
const readServer = () => false;

export function SignalField({
  people,
  selectedId,
  onSelect,
  loading = false,
  embeddingPending = false,
}: {
  people: FieldPerson[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  loading?: boolean;
  /** Embeddings not ready: skeleton, never fake nodes. */
  embeddingPending?: boolean;
}) {
  const compact = useSyncExternalStore(subscribeCompact, readCompact, readServer);
  const reducedMotion = useSyncExternalStore(subscribeMotion, readMotion, readServer);

  const shown = useMemo(() => {
    const entries = people.map((person) => ({ person, id: person.id, score: person.recommendation?.score ?? null }));
    const subset = compact ? compactSelection(entries, selectedId) : entries;
    return subset.map((entry) => entry.person);
  }, [people, compact, selectedId]);

  const empty = people.length === 0;
  const pending = embeddingPending && empty;
  const ready = !loading && !embeddingPending;

  return (
    <div
      role="group"
      aria-label="Attendee field"
      aria-busy={loading || embeddingPending}
      className="relative h-[28rem] w-full min-h-0 touch-manipulation min-[720px]:h-full"
    >
      <SignalGalaxy people={shown} selectedId={selectedId} onSelect={onSelect} reducedMotion={reducedMotion} ready={ready} />
      {pending ? (
        <div role="status" className="absolute inset-0 grid place-items-center">
          <div className="flex w-full max-w-[16rem] flex-col items-center gap-3 px-6">
            <div aria-hidden="true" className="flex w-full animate-pulse flex-col items-center gap-2.5">
              <div className="h-2.5 w-3/4 rounded-full bg-surface-raised" />
              <div className="h-2.5 w-full rounded-full bg-surface-raised" />
              <div className="h-2.5 w-1/2 rounded-full bg-surface-raised" />
            </div>
            <p className="font-mono text-xs tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase">
              Finding your people…
            </p>
          </div>
        </div>
      ) : null}
      {!pending && empty ? (
        <p
          role="status"
          className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-surface/80 px-3 py-1.5 font-mono text-xs tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase shadow-sm"
        >
          {loading ? "Loading the room" : "No members yet"}
        </p>
      ) : null}
      <ul className="sr-only">
        <li>
          <button type="button" aria-pressed={selectedId === FIELD_SELF_ID} onClick={() => onSelect(selectedId === FIELD_SELF_ID ? null : FIELD_SELF_ID)}>
            You
          </button>
        </li>
        {shown.map((person) => (
          <li key={person.id}>
            <button type="button" aria-pressed={person.id === selectedId} onClick={() => onSelect(person.id === selectedId ? null : person.id)}>
              {person.demo ? `${person.displayName}, demo` : person.displayName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
