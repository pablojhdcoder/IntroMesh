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
  if (!context) throw new Error("ThemeSwitch necesita ThemeProvider");
  const { theme, toggleTheme } = context;
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Tema oscuro. Cambiar a modo claro." : "Tema claro. Cambiar a modo oscuro."}
      onClick={toggleTheme}
      className={cn(
        "group relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        className,
      )}
    >
      <span className="relative flex h-7 w-[50px] items-center rounded-full border border-border bg-[var(--switch-track)] p-0.5 transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none">
        <span
          aria-hidden
          className="absolute top-0.5 left-0.5 size-[22px] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:translate-x-[22px]"
        >
          <span className="block size-full rounded-full bg-[var(--switch-thumb)] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-[0.92] motion-reduce:transition-none" />
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
