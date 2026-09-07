import type { WorkspaceTheme } from "./types";

const tokenMap = {
  background: "--page",
  primaryColor: "--primary",
  secondaryColor: "--secondary",
  accentColor: "--accent",
  accentSoft: "--accent-soft",
  accentRgb: "--accent-rgb",
  glassStyle: "--glass",
  cardStyle: "--panel",
  cardSoft: "--panel-soft",
  borderStyle: "--line",
  borderStrong: "--line-bright",
  glowStyle: "--theme-glow",
  shadowStyle: "--theme-shadow",
  textStyle: "--text",
  textMuted: "--muted",
  textFaint: "--muted-2",
  iconStyle: "--icon",
  barStyle: "--theme-bar",
  navStyle: "--theme-nav",
  inputStyle: "--theme-input",
  heroOverlay: "--theme-hero-overlay",
} as const;

export function applyWorkspaceTheme(theme: WorkspaceTheme, animate = true) {
  const root = document.documentElement;
  if (animate && root.dataset.theme && root.dataset.theme !== theme.id) root.classList.add("theme-changing");
  root.dataset.theme = theme.id;
  root.dataset.themeMode = theme.mode;
  root.style.colorScheme = theme.mode;
  Object.entries(theme.tokens).forEach(([key, value]) => root.style.setProperty(tokenMap[key as keyof typeof tokenMap], value));
  root.style.setProperty("--theme-wallpaper", `url("${theme.wallpaper}")`);
  root.style.setProperty("--purple", theme.tokens.accentColor);
  root.style.setProperty("--purple-soft", theme.tokens.accentSoft);
  window.setTimeout(() => root.classList.remove("theme-changing"), 560);
}
