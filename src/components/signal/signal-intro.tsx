"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const stepTransition = {
  duration: 0.28,
  ease: [0.23, 1, 0.32, 1] as const,
};

/** Slow enough to actually read: the old 1.4s auto-advance outran the copy. */
const STEP_MS = 4000;
const LAST_STEP = 3;

/** A glass sphere in miniature: same colors as the real field, both themes. */
function MiniSphere({ size, tone, className }: { size: number; tone: "green" | "grey"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block shrink-0 rounded-full shadow-[0_10px_24px_rgb(22_24_15/0.25)] dark:shadow-[0_10px_24px_rgb(0_0_0/0.6)]",
        tone === "green" ? "bg-[#16a34a] dark:bg-[#2fd35f]" : "bg-[#8a877c] opacity-70 dark:bg-[#9c978c]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="absolute top-[18%] left-[22%] size-[28%] rounded-full bg-white/80 blur-[3px]" />
      <span className="absolute top-[46%] left-[52%] size-[14%] rounded-full bg-white/50 blur-[2px]" />
      <span className="absolute inset-0 rounded-full shadow-[inset_0_-10px_18px_rgb(0_0_0/0.28),inset_0_6px_12px_rgb(255_255_255/0.25)]" />
    </span>
  );
}

type MiniNode = { label: string; x: string; y: string; size: number; tone: "green" | "grey" };

const SIGNAL_NODES: MiniNode[] = [
  { label: "Ana · demo", x: "16%", y: "16%", size: 42, tone: "green" },
  { label: "Leo · demo", x: "76%", y: "22%", size: 34, tone: "green" },
  { label: "Mia · demo", x: "66%", y: "72%", size: 38, tone: "green" },
  { label: "Alex · demo", x: "20%", y: "74%", size: 28, tone: "grey" },
];

/**
 * A small, honest scale model of the real field: "You" biggest at the
 * center, green signals on threads with their names floating below,
 * everyone else smaller, greyer, further out. Example names carry the
 * demo mark, like any synthetic data in the product.
 */
function MiniField({ variant, reduceMotion }: { variant: "you" | "signals" | "focus"; reduceMotion: boolean }) {
  if (variant === "focus") {
    return (
      <div aria-hidden="true" className="relative mx-auto h-44 w-full max-w-sm">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 60" preserveAspectRatio="none">
          <line x1="24" y1="30" x2="58" y2="30" stroke="var(--signal-vivid)" strokeWidth="1.4" opacity="0.85" />
        </svg>
        <span className="absolute top-1/2 left-[24%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
          <span className="font-heading text-sm">You</span>
          <MiniSphere size={36} tone="green" />
        </span>
        <motion.span
          className="absolute top-1/2 left-[62%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        >
          <MiniSphere size={64} tone="green" className="shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--signal-vivid)]" />
          <span className="mt-1.5 font-heading text-base">Ana · demo</span>
        </motion.span>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="relative mx-auto h-52 w-full max-w-sm">
      {variant === "signals" ? (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {SIGNAL_NODES.map((node) => (
            <line
              key={node.label}
              x1="50"
              y1="50"
              x2={Number.parseFloat(node.x) + 4}
              y2={Number.parseFloat(node.y) + 6}
              stroke={node.tone === "green" ? "var(--signal-vivid)" : "var(--border)"}
              strokeWidth={node.tone === "green" ? 0.9 : 0.5}
              opacity={node.tone === "green" ? 0.75 : 0.9}
            />
          ))}
        </svg>
      ) : null}
      <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <span className="mb-1 font-heading text-base">You</span>
        <motion.span
          animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
          transition={reduceMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <MiniSphere size={variant === "you" ? 76 : 54} tone="green" />
        </motion.span>
      </span>
      {variant === "signals"
        ? SIGNAL_NODES.map((node, index) => (
            <motion.span
              key={node.label}
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: node.x, top: node.y }}
              animate={reduceMotion ? undefined : { y: [0, -5 - index, 0] }}
              transition={
                reduceMotion ? undefined : { duration: 4.5 + index * 0.6, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }
              }
            >
              <MiniSphere size={node.size} tone={node.tone} />
              <span className={cn("mt-1 font-heading whitespace-nowrap", node.tone === "green" ? "text-sm" : "text-xs text-muted-foreground")}>
                {node.label}
              </span>
            </motion.span>
          ))
        : null}
    </div>
  );
}

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
  const reduceMotion = useReducedMotion() ?? false;
  const [step, setStep] = useState(0);
  // Any manual navigation pauses the auto-advance for good: the tutorial
  // moves at the reader's pace, not the timer's.
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (reduceMotion || interacted || step >= LAST_STEP) return;
    const timer = window.setTimeout(() => setStep((value) => Math.min(LAST_STEP, value + 1)), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [step, reduceMotion, interacted]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onSkip();
      if (event.key === "ArrowRight") {
        setInteracted(true);
        setStep((value) => Math.min(LAST_STEP, value + 1));
      }
      if (event.key === "ArrowLeft") {
        setInteracted(true);
        setStep((value) => Math.max(0, value - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  function goTo(next: number) {
    setInteracted(true);
    setStep(Math.max(0, Math.min(LAST_STEP, next)));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How the signal field works"
      className="relative flex min-h-[30rem] w-full flex-col items-center justify-center gap-5 overflow-hidden rounded-[20px] border border-border bg-background px-6 py-10 text-center min-[720px]:min-h-[34rem]"
    >
      <div className="absolute top-4 right-4">
        <Button type="button" variant="ghost" size="sm" onClick={onSkip} className={cn("h-9", focusRing)}>
          Skip
        </Button>
      </div>

      <p className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase" aria-live="polite">
        Step {step + 1} of {LAST_STEP + 1}
      </p>

      {step === 0 ? (
        <motion.div
          key="you"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={reduceMotion ? { duration: 0 } : stepTransition}
          className="flex flex-col items-center gap-3"
        >
          <MiniField variant="you" reduceMotion={reduceMotion} />
          <h2 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance">This is you</h2>
          <p className="max-w-[36ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            {displayName}
            {role ? ` · ${role}` : ""}. Your sphere is the big one, and it never moves: you stay at the center of the room while
            everyone else orbits around you.
          </p>
        </motion.div>
      ) : null}

      {step === 1 ? (
        <motion.div
          key="signals"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={reduceMotion ? { duration: 0 } : stepTransition}
          className="flex flex-col items-center gap-3"
          aria-live="polite"
        >
          <MiniField variant="signals" reduceMotion={reduceMotion} />
          <h2 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance">Your signals orbit you</h2>
          <p className="max-w-[40ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            Green spheres are people Meta AI thinks you should meet, tied to you by a thread, with their names floating below.
            Grey spheres are everyone else: smaller, dimmer, further out. Drag the field to turn it; scroll or pinch to zoom.
          </p>
        </motion.div>
      ) : null}

      {step === 2 ? (
        <motion.div
          key="focus"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={reduceMotion ? { duration: 0 } : stepTransition}
          className="flex w-full flex-col items-center gap-3"
        >
          <MiniField variant="focus" reduceMotion={reduceMotion} />
          <h2 className="font-heading text-[2rem] leading-none tracking-[-0.02em] text-balance">Tap a sphere to focus</h2>
          <div className="flex max-w-sm flex-col gap-2 rounded-[12px] border border-border bg-surface px-4 py-3 text-left shadow-[var(--shadow-raise)]">
            <p className="text-sm">
              <span className="font-medium">Ana · demo</span> <span className="text-muted-foreground">— why you two should talk</span>
            </p>
            <ul aria-hidden="true" className="flex flex-wrap gap-1.5">
              {["Shares · drones", "Complements · fundraising"].map((chip) => (
                <li
                  key={chip}
                  className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>
          <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            The camera glides to them from wherever you left the field, and their card opens in Your signals with the reasons, an
            opener you can edit, and Connect. Tap them again — or Back — and you return keeping your rotation.
          </p>
        </motion.div>
      ) : null}

      {step === 3 ? (
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
              Everyone you see is registered for this event. The field and the Your signals panel — on your right, or below on a
              phone — always show the same people, in sync.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-[12px] border border-border bg-surface text-sm">
            <li className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden="true" className="mt-0.5">
                <MiniSphere size={16} tone="green" />
              </span>
              <span>
                <span className="font-medium">You</span>
                <span className="block text-muted-foreground">The big green sphere, always at the center.</span>
              </span>
            </li>
            <li className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden="true" className="mt-0.5">
                <MiniSphere size={14} tone="green" />
              </span>
              <span>
                <span className="font-medium">Recommended</span>
                <span className="block text-muted-foreground">
                  Green, on a thread to you, ranked in Top matches — always with a concrete reason, never just a score.
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden="true" className="mt-0.5">
                <MiniSphere size={12} tone="grey" />
              </span>
              <span>
                <span className="font-medium">Everyone going</span>
                <span className="block text-muted-foreground">Grey and dimmer in the field; the full list lives under Everyone in Your signals, searchable and sortable.</span>
              </span>
            </li>
            <li className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground" />
              <span>
                <span className="font-medium">Your signals panel</span>
                <span className="block text-muted-foreground">
                  Hover or tap a person there and their sphere lights up here; pick a sphere and its card opens there.
                </span>
              </span>
            </li>
          </ul>
        </motion.div>
      ) : null}

      <div className="flex w-full max-w-md items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
          className={cn("h-11 min-[720px]:h-9", focusRing)}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back
        </Button>
        <div className="flex items-center gap-2" role="group" aria-label="Tutorial steps">
          {Array.from({ length: LAST_STEP + 1 }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to step ${index + 1}`}
              aria-current={step === index ? "step" : undefined}
              className={cn(
                "grid size-11 place-items-center rounded-full min-[720px]:size-9",
                focusRing,
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "rounded-full transition-[width,height,background-color] duration-200 motion-reduce:transition-none",
                  step === index ? "size-2.5 bg-[var(--signal-vivid)] dark:bg-signal" : "size-2 bg-border",
                )}
              />
            </button>
          ))}
        </div>
        {step < LAST_STEP ? (
          <Button type="button" onClick={() => goTo(step + 1)} className={cn("h-11 min-[720px]:h-9", focusRing)}>
            Next
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={onDone} className={cn("h-11 min-[720px]:h-9", focusRing)}>
            Enter the room
          </Button>
        )}
      </div>
    </div>
  );
}
