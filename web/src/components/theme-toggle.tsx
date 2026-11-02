"use client";

import { useSyncExternalStore } from "react";
import { t, type Locale, type MessageKey } from "@/lib/i18n";

export type Theme = "system" | "light" | "dark";

const KEY = "theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, MessageKey> = {
  system: "theme.system",
  light: "theme.light",
  dark: "theme.dark",
};

/**
 * Runs in <head> before first paint so a saved theme never flashes the other one.
 * A display preference, not scan data (docs/security-privacy.md §1 bars scan data only).
 */
export const themeScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/**
 * The browser runs this from the server HTML, before paint. On the client it is inert
 * (`text/plain`): it already ran, and React 19 warns about executable scripts it renders.
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}

export function nextTheme(theme: Theme): Theme {
  return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? "system";
}

function readTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Private mode: the choice still holds for this page.
  }
  for (const listener of listeners) listener();
}

export function ThemeToggle({ lang }: { lang: Locale }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as const);
  return (
    <button
      type="button"
      onClick={() => applyTheme(nextTheme(theme))}
      aria-label={`${t(lang, "theme.label")}: ${t(lang, LABEL[theme])}`}
      className="inline-flex min-h-11 items-center justify-center rounded-sm px-1 font-mono text-xs tracking-[0.06em] uppercase hover:text-accent"
    >
      {t(lang, LABEL[theme])}
    </button>
  );
}
