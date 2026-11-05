import Link from "next/link";
import { cn } from "cn";
import { ThemeSwitch } from "@/components/theme-switch";
import { LogoutButton } from "@/components/nav/logout-button";

const LINKS = [
  { id: "events", label: "Events", href: "/events" },
  { id: "connections", label: "Connections", href: "/connections" },
] as const;

export type AppNavActive = (typeof LINKS)[number]["id"] | "profile";

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

function cleanHandle(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/^@+/, "");
  return cleaned.length > 0 ? cleaned : null;
}

export function AppNav({
  active,
  slug,
  handle,
  pendingCount,
}: {
  active?: AppNavActive;
  slug?: string;
  handle?: string | null;
  /** Incoming connection requests waiting for this viewer. */
  pendingCount?: number;
}) {
  void slug;
  const profileHandle = cleanHandle(handle) ?? cleanHandle(slug);
  const profileLabel = profileHandle ? `@${profileHandle}` : "My Profile";
  const isProfileActive = active === "profile";
  return (
    <header className="w-full border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-8">
        <Link
          href="/events"
          className={cn("inline-flex min-h-11 items-center gap-2.5 font-heading text-xl leading-none tracking-[-0.02em]", focusRing)}
        >
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-border bg-[var(--signal-vivid)] dark:bg-signal" />
          IntroMesh
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Primary" className="flex items-center gap-1">
            {LINKS.map((link) => {
              const isActive = active === link.id;
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full px-3 text-sm transition-colors min-[720px]:min-h-9",
                    isActive ? "font-medium text-foreground underline underline-offset-4" : "text-muted-foreground hover:text-foreground",
                    focusRing,
                  )}
                >
                  {link.label}
                  {link.id === "connections" && pendingCount ? (
                    <span
                      aria-label={`${pendingCount} pending ${pendingCount === 1 ? "request" : "requests"}`}
                      className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-signal px-1 font-mono text-[0.65rem] font-medium text-[#14160c] tabular-nums"
                    >
                      {pendingCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <Link
              href="/profile"
              aria-current={isProfileActive ? "page" : undefined}
              aria-label="My profile"
              title={profileHandle ? `My profile — @${profileHandle}` : "My profile"}
              className={cn(
                "inline-flex min-h-11 max-w-36 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors min-[720px]:min-h-9",
                isProfileActive
                  ? "border-foreground/40 font-medium text-foreground"
                  : "text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                focusRing,
              )}
            >
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--signal-vivid)] dark:bg-signal" />
              <span className="truncate font-mono text-[0.8125rem] tracking-tight">{profileLabel}</span>
            </Link>
          </nav>
          <LogoutButton />
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
