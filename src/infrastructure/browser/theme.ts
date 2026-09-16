// Theme resolution + noncritical early-paint hint (Blueprint §D, §M10, §Q).
import type { ThemePreference } from "@/domain/types";
import { THEME_HINT_KEY } from "@/infrastructure/db/schema";

export type ResolvedTheme = "dark" | "light";

export function readThemeHint(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_HINT_KEY);
    if (stored === "DARK" || stored === "LIGHT" || stored === "SYSTEM") return stored;
  } catch {
    /* ignore */
  }
  return "SYSTEM";
}

export function writeThemeHint(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_HINT_KEY, theme);
  } catch {
    /* noncritical */
  }
}

export function clearThemeHint(): void {
  try {
    localStorage.removeItem(THEME_HINT_KEY);
  } catch {
    /* noncritical */
  }
}

function prefersLight(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme === "SYSTEM") return prefersLight() ? "light" : "dark";
  return theme === "LIGHT" ? "light" : "dark";
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

/** Observe OS theme changes; only relevant while preference is SYSTEM. */
export function watchSystemTheme(onChange: (resolved: ResolvedTheme) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const listener = () => onChange(media.matches ? "light" : "dark");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
