import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark";

const KEY = "swe-agent.theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStored(): ThemePreference | null {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function useTheme(): { theme: ThemePreference; toggle: () => void } {
  const [theme, setTheme] = useState<ThemePreference>(
    () => readStored() ?? (systemPrefersDark() ? "dark" : "light"),
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // theme persistence is a convenience, not a requirement
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
