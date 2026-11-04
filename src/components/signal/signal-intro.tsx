"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const stepTransition = {
  duration: 0.28,
  ease: [0.23, 1, 0.32, 1] as const,
};

export function SignalIntro({
  displayName,
  role,
  onDone,
  onSkip,
}: {
  displayName: string;
  role: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced-motion renders the final legend step instantly
      setStep(2);
      return;
    }
    if (step === 0) {
      const timer = window.setTimeout(() => setStep(1), 1400);
      return () => window.clearTimeout(timer);
    }
    if (step === 1) {
      const timer = window.setTimeout(() => setStep(2), 1500);
      return () => window.clearTimeout(timer);
    }
  }, [step, reduceMotion]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onSkip();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How the signal field works"
      className="relative flex min-h-[28rem] w-full flex-col items-center justify-center gap-6 overflow-hidden rounded-[20px] border border-border bg-background px-6 py-12 text-center min-[720px]:min-h-[32rem]"
    >
      <div className="absolute top-4 right-4">
        <Button type="button" variant="ghost" size="sm" onClick={onSkip} className={cn("h-9", focusRing)}>
          Skip
        </Button>
      </div>

      <p className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
        {step === 0 ? "Step 1 of 3" : step === 1 ? "Step 2 of 3" : "Step 3 of 3"}
      </p>

      {step === 0 ? (
        <motion.div
          key="you"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={reduceMotion ? { duration: 0 } : stepTransition}
          className="flex flex-col items-center gap-3"
        >
          <span
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-full border border-border bg-surface shadow-[var(--shadow-raise)]"
          >
            <span className="size-3 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
          </span>
          <h2 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance">This is you</h2>
          <p className="max-w-[32ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            {displayName}
            {role ? ` · ${role}` : ""} stays at the center. Everyone else orbits around you.
          </p>
        </motion.div>
      ) : null}

      {step === 1 ? (
        <motion.div
          key="reveal"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, transform: "translateY(12px) scale(0.98)" }}
          animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
          transition={reduceMotion ? { duration: 0 } : stepTransition}
          className="flex flex-col items-center gap-4"
          aria-live="polite"
        >
          <div aria-hidden="true" className="relative grid size-40 place-items-center">
            <span className="absolute size-28 rounded-full border border-border" />
            <span className="absolute size-36 rounded-full border border-border/60" />
            <span className="absolute top-1/2 left-1/2 h-px w-36 -translate-x-1/2 -translate-y-1/2 rotate-12 bg-[var(--signal-vivid)]/40 dark:bg-signal/50" />
            <span className="absolute top-1/2 left-1/2 h-px w-28 -translate-x-1/2 -translate-y-1/2 -rotate-12 bg-border" />
            <span className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
            <span className="absolute top-[18%] left-[68%] size-2.5 rounded-full bg-foreground/70" />
            <span className="absolute top-[64%] left-[22%] size-2 rounded-full bg-muted-foreground/60" />
          </div>
          <p className="max-w-[36ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            The field lights up around you. Threads are opportunities to meet.
          </p>
        </motion.div>
      ) : null}

      {step === 2 ? (
        <motion.div
          key="legend"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={reduceMotion ? { duration: 0 } : stepTransition}
          className="flex w-full max-w-md flex-col gap-5 text-left"
        >
          <div className="flex flex-col gap-2 text-center">
            <h2 className="font-heading text-[2rem] leading-none tracking-[-0.02em]">Read the room</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Everyone you see is registered for this event. Threads point to your closest matches — say hello before the day.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-[12px] border border-border bg-surface text-sm">
            <li className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
              <span>
                <span className="font-medium">You</span>
                <span className="block text-muted-foreground">Always at the center.</span>
              </span>
            </li>
            <li className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground" />
              <span>
                <span className="font-medium">Recommended</span>
                <span className="block text-muted-foreground">
                  Compatibility with a concrete reason — shared interests and complements.
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>
                <span className="font-medium">Everyone going</span>
                <span className="block text-muted-foreground">Everyone registered, listed below.</span>
              </span>
            </li>
          </ul>
          <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:justify-center">
            <Button type="button" onClick={onDone} className={cn("h-11 min-[720px]:h-9", focusRing)}>
              Enter the room
            </Button>
            <Button type="button" variant="ghost" onClick={onSkip} className={cn("h-11 min-[720px]:h-9", focusRing)}>
              Skip tour
            </Button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
