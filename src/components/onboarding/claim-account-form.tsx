"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { normalizeUsername, passwordChecks } from "@/domain/auth";
import { Button } from "@/components/ui/button";
import { PasswordRequirements } from "@/components/onboarding/password-requirements";

const field =
  "flex flex-col gap-2 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";
const input =
  "h-11 rounded-[12px] border border-border bg-surface px-3.5 font-sans text-[1rem] normal-case tracking-normal text-foreground transition-colors hover:border-foreground/25";
const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

function cleanUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 20);
}

export function ClaimAccountForm({ onClaimed }: { onClaimed: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "reserved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);

  const normalized = normalizeUsername(username);
  const checks = passwordChecks(password, normalized);
  const effectiveAvailability = normalized.length < 3 ? "idle" : availability;
  const ready = !pending && normalized.length >= 3 && effectiveAvailability === "available" && checks.every((item) => item.met);

  useEffect(() => {
    if (normalized.length < 3) return;
    const id = ++requestId.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (requestId.current !== id) return;
      setAvailability("checking");
      void fetch(`/api/auth/availability?username=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json()) as { reason?: typeof availability };
          if (requestId.current !== id) return;
          const reason = body.reason ?? "invalid";
          setAvailability(reason);
        })
        .catch((fetchError) => {
          if (requestId.current !== id) return;
          if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
          setAvailability("idle");
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalized]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: normalized, password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        if (body.error === "username_taken" || body.error === "account_exists") {
          setError("That @ is already taken.");
        } else if (body.error === "password_weak") {
          setError("That password does not meet the requirements.");
        } else if (body.error === "demo") {
          setError("Demo profiles cannot claim an @.");
        } else {
          setError("Could not claim. Try again.");
        }
        return;
      }
      onClaimed();
    } catch {
      setError("Could not claim. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" aria-label="Claim your @">
      <h2 className="font-heading text-xl leading-none tracking-[-0.02em]">Claim your @</h2>
      <p className="text-sm text-muted-foreground">
        Link this profile to a permanent @. It cannot be changed later.
      </p>
      <label className={field} htmlFor="claim-username">
        @handle
        <span className={cn(input, "flex items-center gap-1 px-0 focus-within:border-foreground/40")}>
          <span aria-hidden="true" className="pl-3.5 text-muted-foreground">@</span>
          <input
            id="claim-username"
            value={username}
            onChange={(event) => setUsername(cleanUsername(event.target.value))}
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            placeholder="pablo"
            className="h-full w-full bg-transparent pr-3.5 outline-none placeholder:text-muted-foreground/60"
          />
        </span>
      </label>
      {effectiveAvailability !== "idle" ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 text-sm",
            effectiveAvailability === "available"
              ? "font-medium text-foreground"
              : effectiveAvailability === "checking"
                ? "text-muted-foreground"
                : "text-destructive",
          )}
        >
          {effectiveAvailability === "available" ? (
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
          ) : null}
          {effectiveAvailability === "checking" ? "Checking…" : `@${normalized} ${effectiveAvailability}`}
        </p>
      ) : null}
      <label className={field} htmlFor="claim-password">
        Password
        <span className={cn(input, "flex items-center gap-2 pr-2 focus-within:border-foreground/40")}>
          <input
            id="claim-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={128}
            autoComplete="new-password"
            className="h-full w-full bg-transparent outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:text-foreground",
              focusRing,
            )}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </span>
      </label>
      <PasswordRequirements checks={checks} />
      <div>
        <Button type="submit" disabled={!ready} className="h-11 min-[720px]:h-9">
          {pending ? "Claiming…" : "Claim @"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : null}
    </form>
  );
}
