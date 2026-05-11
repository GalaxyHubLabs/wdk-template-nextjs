"use client";

/**
 * Three-state theme toggle: system → light → dark → system.
 *
 * The choice persists in `localStorage` under `wdk-template:theme`. The
 * inline script in `app/layout.tsx` reads it before React hydrates so the
 * page doesn't flash the wrong palette on first paint.
 */

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "wdk-template:theme";

function readStored(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setThemeState] = React.useState<Theme>("system");

  // Hydrate from storage on mount.
  React.useEffect(() => {
    setThemeState(readStored());
  }, []);

  // Apply on every change.
  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // When the user picks "system", keep tracking OS-level changes.
  React.useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    setThemeState(next);
  }, []);

  return [theme, setTheme];
}

/** Inline script body, run pre-React to avoid the FOUC flash. */
export const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    var dark = t === 'dark' || ((t === null || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();`;

const ORDER: Theme[] = ["system", "light", "dark"];
const ICON: Record<Theme, React.ComponentType<{ size?: number }>> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};
const LABEL: Record<Theme, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

interface ThemeToggleProps {
  className?: string;
}

/** Compact button that cycles between system / light / dark. Renders nothing
 *  during SSR / first paint to avoid a hydration mismatch. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <span className={cn("inline-block h-9 w-9", className)} aria-hidden />;
  }
  const Icon = ICON[theme];
  return (
    <button
      type="button"
      onClick={() => {
        const idx = ORDER.indexOf(theme);
        setTheme(ORDER[(idx + 1) % ORDER.length]);
      }}
      aria-label={`Current theme: ${LABEL[theme]}. Click to change.`}
      title={LABEL[theme]}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 transition-colors",
        "hover:bg-zinc-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
        "dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
        className,
      )}
    >
      <Icon size={16} />
    </button>
  );
}
