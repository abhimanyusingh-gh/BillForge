import { useEffect } from "react";
import { useSessionStore, type ThemeMode } from "@/state/sessionStore";

const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

function resolveAppliedTheme(theme: ThemeMode): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia(SYSTEM_QUERY).matches ? "dark" : "light";
}

interface UseThemeResult {
  theme: ThemeMode;
  appliedTheme: "light" | "dark";
  setTheme: (next: ThemeMode) => void;
}

export function useTheme(): UseThemeResult {
  const theme = useSessionStore((state) => state.theme);
  const setTheme = useSessionStore((state) => state.setTheme);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const apply = () => {
      document.documentElement.dataset.theme = resolveAppliedTheme(theme);
    };
    apply();
    if (theme !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(SYSTEM_QUERY);
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [theme]);

  return {
    theme,
    appliedTheme: resolveAppliedTheme(theme),
    setTheme
  };
}
