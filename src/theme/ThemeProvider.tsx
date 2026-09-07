import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { applyWorkspaceTheme } from "./themeManager";
import { getThemeById } from "./themes";
import { useThemeStore } from "./themeStore";
import type { WorkspaceTheme } from "./types";

const ThemeContext = createContext<WorkspaceTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useThemeStore((state) => state.themeId);
  const customThemes = useThemeStore((state) => state.customThemes);
  const theme = useMemo(() => getThemeById(themeId, customThemes), [themeId, customThemes]);

  useEffect(() => { applyWorkspaceTheme(theme); }, [theme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useWorkspaceTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useWorkspaceTheme must be used inside ThemeProvider");
  return theme;
}
