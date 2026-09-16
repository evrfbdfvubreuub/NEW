import { useEffect } from "react";
import { useAppState } from "@/state/store-context";
import {
  applyResolvedTheme,
  resolveTheme,
  watchSystemTheme,
  writeThemeHint,
} from "@/infrastructure/browser/theme";

/** Applies the selected theme and follows the OS when preference is SYSTEM. */
export function ThemeController(): null {
  const { data } = useAppState();
  const theme = data?.settings.theme ?? "SYSTEM";

  useEffect(() => {
    writeThemeHint(theme);
    applyResolvedTheme(resolveTheme(theme));
  }, [theme]);

  useEffect(() => {
    if (theme !== "SYSTEM") return;
    return watchSystemTheme((resolved) => applyResolvedTheme(resolved));
  }, [theme]);

  return null;
}
