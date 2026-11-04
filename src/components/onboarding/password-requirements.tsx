"use client";

import { Check } from "lucide-react";
import { cn } from "cn";
import type { PasswordCheck } from "@/domain/auth";

export function PasswordRequirements({ checks }: { checks: PasswordCheck[] }) {
  return (
    <ul aria-label="Password requirements" className="flex flex-col gap-1">
      {checks.map((check) => (
        <li
          key={check.id}
          aria-live="polite"
          className={cn(
            "flex items-center gap-2.5 rounded-full px-2 py-1 text-sm transition-colors duration-200 motion-reduce:transition-none",
            check.met ? "bg-[var(--signal-vivid)]/12 dark:bg-signal/15" : "",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 motion-reduce:transition-none",
              check.met
                ? "border-transparent bg-[var(--signal-vivid)] text-white dark:bg-signal dark:text-[#14160c]"
                : "border-border bg-transparent text-muted-foreground/40",
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span className={check.met ? "font-medium text-foreground" : "text-muted-foreground"}>
            {check.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
