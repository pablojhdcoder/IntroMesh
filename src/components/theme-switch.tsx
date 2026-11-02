"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "cn";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  const [current, setCurrent] = useState(theme);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", current === "dark");
  }, [current]);

  useEffect(() => {
    document.documentElement.classList.add("theme-ready");
  }, []);

  function toggleTheme() {
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setCurrent(next);
  }

  return <ThemeContext.Provider value={{ theme: current, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemeSwitch({ className }: { className?: string }) {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeSwitch requires ThemeProvider");
  const { theme, toggleTheme } = context;
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Dark theme. Switch to light mode." : "Light theme. Switch to dark mode."}
      onClick={toggleTheme}
      className={cn(
        "group relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        className,
      )}
    >
      <span className="relative flex h-7 w-[50px] items-center rounded-full border border-border bg-[var(--switch-track)] shadow-[inset_0_1px_2px_rgb(22_24_15/0.08)] p-0.5 transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)]">
        <span
          aria-hidden
          className="absolute top-0.5 left-0.5 size-[22px] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:translate-x-[22px]"
        >
          <span className="block size-full rounded-full bg-[var(--switch-thumb)] shadow-[0_1px_2px_rgb(22_24_15/0.18),0_1px_3px_rgb(22_24_15/0.12)] ring-1 ring-border/60 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-[0.92] motion-reduce:transition-none dark:shadow-[0_1px_2px_rgb(0_0_0/0.45)]" />
        </span>
        <span className="relative z-10 grid size-[22px] place-items-center">
          <Sun
            aria-hidden
            className="block size-3 text-foreground transition-[color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:text-muted-foreground"
            strokeWidth={1.75}
          />
        </span>
        <span className="relative z-10 grid size-[22px] place-items-center">
          <Moon
            aria-hidden
            className="block size-3 text-muted-foreground transition-[color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:text-foreground"
            strokeWidth={1.75}
          />
        </span>
      </span>
    </button>
  );
}
