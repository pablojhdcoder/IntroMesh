import Link from "next/link";
import { cn } from "cn";
import { ThemeSwitch } from "@/components/theme-switch";

const LINKS = [
  { id: "events", label: "Events", href: "/events" },
  { id: "connections", label: "Connections", href: "/connections" },
  { id: "profile", label: "My Profile", href: "/profile" },
] as const;

export type AppNavActive = (typeof LINKS)[number]["id"];

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

export function AppNav({ active, slug }: { active?: AppNavActive; slug?: string }) {
  void slug;
  return (
    <header className="w-full border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-8">
        <Link
          href="/events"
          className={cn("inline-flex min-h-11 items-center gap-2.5 font-heading text-xl leading-none tracking-[-0.02em]", focusRing)}
        >
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-border bg-signal" />
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
                </Link>
              );
            })}
          </nav>
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
