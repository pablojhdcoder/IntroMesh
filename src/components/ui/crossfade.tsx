"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function Crossfade({
  id,
  children,
  className,
  initial = false,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  initial?: boolean;
}) {
  const reduce = useReducedMotion();
  const duration = reduce ? 0.16 : 0.28;
  const exitDuration = 0.16;

  return (
    <AnimatePresence mode="wait" initial={initial}>
      <motion.div
        key={id}
        className={className}
        initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px)" }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
        exit={
          reduce
            ? { opacity: 0, transition: { duration: exitDuration, ease: easeOut } }
            : { opacity: 0, transform: "translateY(-8px)", transition: { duration: exitDuration, ease: easeOut } }
        }
        transition={{ duration, ease: easeOut }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
