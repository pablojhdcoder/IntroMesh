"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";

const stages = [
  {
    id: "discover",
    label: "Descubrir",
    copy: "Quién está visible en esta sesión. Hace falta consentimiento, y se puede retirar.",
  },
  {
    id: "understand",
    label: "Comprender",
    copy: "Una razón concreta. Aparece cuando ya hay candidatos reales, no antes.",
  },
  {
    id: "connect",
    label: "Conectar",
    copy: "Las dos personas aceptan. El enlace, el QR y NFC llevan el mismo identificador.",
  },
  {
    id: "learn",
    label: "Aprender",
    copy: "El evento conserva agregados. Los perfiles que no se mostraron no entran.",
  },
] as const;

const easeOut = [0.23, 1, 0.32, 1] as const;

export function LoopStage() {
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState<(typeof stages)[number]["id"]>("discover");
  const stage = stages.find((item) => item.id === active) ?? stages[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap">
        {stages.map((item) => {
          const selected = item.id === active;
          return (
            <Button
              key={item.id}
              type="button"
              variant={selected ? "default" : "ghost"}
              aria-pressed={selected}
              onClick={() => setActive(item.id)}
            >
              {item.label}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-16">
        <p className="max-w-[42ch] text-[0.9375rem] leading-normal text-muted-foreground">{stage.copy}</p>
        <DemoSignal active={active === "discover"} reducedMotion={reducedMotion === true} />
      </div>
    </div>
  );
}

function DemoSignal({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  return (
    <figure className="flex w-56 shrink-0 flex-col gap-4">
      <svg viewBox="0 0 220 96" className="h-24 w-full" role="img" aria-label="Demostración de tres nodos">
        <line x1="28" y1="48" x2="110" y2="48" stroke="currentColor" strokeOpacity="0.2" />
        <line x1="110" y1="48" x2="192" y2="48" stroke="currentColor" strokeOpacity="0.2" />
        <circle cx="28" cy="48" r="6" fill="currentColor" opacity="0.45" />
        <circle cx="192" cy="48" r="6" fill="currentColor" opacity="0.45" />
        {reducedMotion ? (
          <circle cx="110" cy="48" r="8" fill={active ? "var(--signal)" : "currentColor"} />
        ) : (
          <motion.circle
            cx="110"
            cy="48"
            r="8"
            fill={active ? "var(--signal)" : "currentColor"}
            animate={{ scale: active ? 1 : 0.92 }}
            transition={{ duration: 0.28, ease: easeOut }}
            style={{ transformOrigin: "110px 48px" }}
          />
        )}
      </svg>
      <figcaption className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
        Demostración
      </figcaption>
      <ul className="flex flex-col gap-2 text-sm text-foreground">
        <li>Tú</li>
        <li>Señal posible</li>
        <li>Otra persona visible</li>
      </ul>
    </figure>
  );
}
