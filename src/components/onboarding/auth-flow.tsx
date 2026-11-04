"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { normalizeUsername, passwordChecks } from "@/domain/auth";
import { Button } from "@/components/ui/button";
import { Crossfade } from "@/components/ui/crossfade";
import { ThemeSwitch } from "@/components/theme-switch";
import { PasswordRequirements } from "@/components/onboarding/password-requirements";

const field =
  "flex flex-col gap-2 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";
const input =
  "h-11 rounded-[12px] border border-border bg-surface px-3.5 font-sans text-[1rem] normal-case tracking-normal text-foreground transition-colors hover:border-foreground/25";
const badge = "font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase";
const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid" | "reserved";

const AVAILABILITY_COPY: Record<Exclude<Availability, "idle" | "checking">, string> = {
  available: "is available",
  taken: "is taken — try another",
  invalid: "3–20 chars: letters, numbers, _ or .",
  reserved: "is reserved — try another",
};

function cleanUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 20);
}

export function AuthFlow({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);

  const normalized = normalizeUsername(username);
  const checks = passwordChecks(password, normalized);
  const strong = checks.every((item) => item.met);
  const effectiveAvailability = normalized.length < 3 ? "idle" : availability;
  const registerReady =
    !pending && normalized.length >= 3 && effectiveAvailability === "available" && strong;

  useEffect(() => {
    if (mode !== "register") return;
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
          const body = (await response.json()) as { reason?: Availability };
          if (requestId.current !== id) return;
          const reason = body.reason ?? "invalid";
          setAvailability(reason === "available" ? "available" : reason);
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
  }, [normalized, mode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (mode === "register" && !registerReady) return;
    if (mode === "login" && (normalized.length < 3 || password.length === 0)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: normalized, password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        if (body.error === "username_taken") setError("That @ is already taken.");
        else if (body.error === "password_weak") setError("That password does not meet the requirements.");
        else if (body.error === "credentials") setError("Invalid @ or password.");
        else setError("Could not continue. Try again.");
        return;
      }
      onAuthed();
    } catch {
      setError("Could not continue. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-6 sm:px-8 min-[720px]:py-12"
      onSubmit={(event) => void submit(event)}
      aria-label={mode === "register" ? "Create account" : "Log in"}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-4 flex items-center gap-2 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
            IntroMesh — Account
          </p>
          <Crossfade id={mode} className="flex flex-col gap-3">
            <h1 className="font-heading text-[2rem] leading-none tracking-[-0.03em] text-balance min-[720px]:text-[3.25rem]">
              {mode === "register" ? "Claim your @" : "Welcome back."}
            </h1>
            <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
              {mode === "register"
                ? "One handle for every event. Pick it once — it cannot change."
                : "Log in with your @ to find your events."}
            </p>
          </Crossfade>
        </div>
        <ThemeSwitch />
      </div>

      <div className="flex flex-col gap-2">
        <p className={badge}>01 — Account</p>
        <div
          className="h-px bg-border"
          role="progressbar"
          aria-label="Step 01: Account"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={20}
        >
          <div className="h-px w-[20%] bg-[var(--signal-vivid)] dark:bg-signal" />
        </div>
      </div>

      <Crossfade id={mode} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <label className={field} htmlFor="auth-username">
            @handle
            <span
              className={cn(
                input,
                "flex items-center gap-1 px-0 focus-within:border-foreground/40",
              )}
            >
              <span aria-hidden="true" className="pl-3.5 text-muted-foreground">
                @
              </span>
              <input
                id="auth-username"
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
          {mode === "register" && effectiveAvailability !== "idle" ? (
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
              {effectiveAvailability === "checking"
                ? "Checking…"
                : `@${normalized} ${AVAILABILITY_COPY[effectiveAvailability as Exclude<Availability, "idle" | "checking">]}`}
            </p>
          ) : null}

          <label className={field} htmlFor="auth-password">
            Password
            <span className={cn(input, "flex items-center gap-2 pr-2 focus-within:border-foreground/40")}>
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                maxLength={128}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
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
          {mode === "register" ? <PasswordRequirements checks={checks} /> : null}
        </div>

        <div className="flex flex-col gap-2 min-[720px]:flex-row">
          <Button
            type="submit"
            className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto"
            disabled={
              pending ||
              (mode === "register" ? !registerReady : normalized.length < 3 || password.length === 0)
            }
          >
            {pending ? (mode === "register" ? "Creating" : "Logging in") : mode === "register" ? "Create account" : "Log in"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto"
            onClick={() => {
              setMode(mode === "register" ? "login" : "register");
              setError(null);
            }}
          >
            {mode === "register" ? "I already have an account" : "Create a new account"}
          </Button>
        </div>
      </Crossfade>

      {error ? (
        <p role="alert" className="rounded-[8px] bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
