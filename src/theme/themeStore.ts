import { create } from "zustand";
import type { ThemeId, WorkspaceTheme } from "./types";

type ThemeState = {
  themeId: ThemeId;
  customThemes: WorkspaceTheme[];
  setTheme: (themeId: ThemeId) => void;
  addCustomTheme: (theme: WorkspaceTheme) => void;
  deleteCustomTheme: (themeId: ThemeId) => void;
  loadAccountTheme: (themeId: ThemeId, customThemes: WorkspaceTheme[]) => void;
  clearAccountTheme: () => void;
};

export const useThemeStore = create<ThemeState>()(
  (set, get) => ({
    themeId: "cosmic",
    customThemes: [],
    setTheme: (themeId) => set({ themeId }),
    addCustomTheme: (theme) => set((state) => ({ customThemes: [theme, ...state.customThemes.filter((item) => item.id !== theme.id)], themeId: theme.id })),
    deleteCustomTheme: (themeId) => set((state) => ({
      customThemes: state.customThemes.filter((theme) => theme.id !== themeId),
      themeId: get().themeId === themeId ? "cosmic" : state.themeId,
    })),
    loadAccountTheme: (themeId, customThemes) => set({ themeId, customThemes }),
    clearAccountTheme: () => set({ themeId: "cosmic", customThemes: [] }),
  }),
);
