"use client";

import { motion, useReducedMotion } from "motion/react";

export type FieldPerson = {
  id: string;
  slug: string;
  displayName: string;
  role: string;
  demo: boolean;
  x: number;
  y: number;
  presence: "active" | "seeking";
  recommendation: {
    score: number;
    confidence: "low" | "medium" | "high";
    shared: { goals: string[]; interests: string[]; skills: string[] };
    complement: string[];
  } | null;
};

const easeOut = [0.23, 1, 0.32, 1] as const;

export function SignalField({
  people,
  selectedId,
  onSelect,
}: {
  people: FieldPerson[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  const recommended = people.filter((person) => person.recommendation);

  return (
    <div className="relative min-h-[32rem] w-full overflow-hidden rounded-xl border border-border bg-surface">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
        {recommended.slice(0, 6).map((person) => (
          <line
            key={person.id}
            x1="50"
            y1="50"
            x2={person.x}
            y2={person.y}
            stroke={person.id === selectedId ? "var(--field-edge-active)" : "var(--field-edge)"}
            strokeWidth={person.id === selectedId ? 0.45 : 0.2}
          />
        ))}
        <circle cx="50" cy="50" r="1.4" fill="var(--node-hot)" />
      </svg>
      <p className="absolute top-4 left-4 font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">Tú</p>
      {people.map((person, index) => {
        const hot = Boolean(person.recommendation);
        const selected = person.id === selectedId;
        return (
          <motion.button
            key={person.id}
            type="button"
            className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-signal"
            style={{ left: `${person.x}%`, top: `${person.y}%` }}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28, ease: easeOut, delay: reduced ? 0 : Math.min(index, 8) * 0.03 }}
            aria-pressed={selected}
            aria-label={person.displayName}
            onClick={() => onSelect(person.id)}
          >
            <span
              className={`size-3 rounded-full ${hot ? "bg-[var(--node-hot)]" : "bg-foreground/40"} ${selected ? "ring-2 ring-[var(--signal-strong)] ring-offset-2 ring-offset-surface" : ""}`}
            />
            {hot || selected ? (
              <span
                className={`pointer-events-none absolute top-1/2 max-w-32 truncate text-xs text-foreground ${
                  person.x >= 50 ? "left-6 -translate-y-1/2" : "right-6 -translate-y-1/2"
                }`}
              >
                {person.displayName}
              </span>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}
