export type OfficialThemeId = "cosmic" | "forest" | "ocean" | "minimal" | "future";
export type CustomThemeId = `custom-${string}`;
export type ThemeId = OfficialThemeId | CustomThemeId;

export type ThemeMode = "dark" | "light";

export type ThemeTokens = {
  background: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  accentSoft: string;
  accentRgb: string;
  glassStyle: string;
  cardStyle: string;
  cardSoft: string;
  borderStyle: string;
  borderStrong: string;
  glowStyle: string;
  shadowStyle: string;
  textStyle: string;
  textMuted: string;
  textFaint: string;
  iconStyle: string;
  barStyle: string;
  navStyle: string;
  inputStyle: string;
  heroOverlay: string;
};

export type ThemePalette = {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
};

export type WorkspaceTheme = {
  id: ThemeId;
  source: "official" | "custom";
  name: string;
  eyebrow: string;
  description: string;
  wallpaper: string;
  heroAlt: string;
  mode: ThemeMode;
  colorPalette: ThemePalette;
  createdTime?: string;
  tokens: ThemeTokens;
};
