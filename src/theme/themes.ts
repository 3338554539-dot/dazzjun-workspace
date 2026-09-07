import type { OfficialThemeId, ThemeId, WorkspaceTheme } from "./types";

export const workspaceThemes: WorkspaceTheme[] = [
  {
    id: "cosmic", source: "official", name: "Dazzjun Cosmic", eyebrow: "ORIGINAL SPACE",
    description: "深色宇宙、紫色星环与未来城市。", wallpaper: "/assets/dazzjun-orbit-hero.png",
    heroAlt: "紫色星环与未来建筑构成的抽象空间", mode: "dark",
    colorPalette: { background: "#03050d", primary: "#6850aa", secondary: "#292143", accent: "#9a73ff", text: "#eeeef7" },
    tokens: {
      background: "#03050d", primaryColor: "#6850aa", secondaryColor: "#292143", accentColor: "#9a73ff", accentSoft: "#bca6ff", accentRgb: "154,115,255",
      glassStyle: "rgba(8,11,23,.82)", cardStyle: "rgba(13,17,30,.86)", cardSoft: "rgba(18,22,38,.68)", borderStyle: "rgba(196,200,233,.15)", borderStrong: "rgba(187,168,255,.32)",
      glowStyle: "0 0 28px rgba(154,115,255,.22)", shadowStyle: "0 18px 52px rgba(0,0,0,.22)", textStyle: "#eeeef7", textMuted: "#85889d", textFaint: "#606477", iconStyle: "#bca6ff",
      barStyle: "rgba(2,5,14,.92)", navStyle: "rgba(15,19,34,.76)", inputStyle: "rgba(3,6,15,.48)", heroOverlay: "rgba(2,4,12,.12)",
    },
  },
  {
    id: "forest", source: "official", name: "Quiet Forest", eyebrow: "NATURAL RHYTHM",
    description: "暮林、雾气与温柔的鼠尾草绿。", wallpaper: "/assets/theme-forest-dusk.png",
    heroAlt: "暮色森林、静水与暖色光环构成的自然空间", mode: "dark",
    colorPalette: { background: "#050d0d", primary: "#477e67", secondary: "#233f35", accent: "#82bfa0", text: "#eef4f0" },
    tokens: {
      background: "#050d0d", primaryColor: "#477e67", secondaryColor: "#233f35", accentColor: "#82bfa0", accentSoft: "#b9d9c7", accentRgb: "130,191,160",
      glassStyle: "rgba(6,19,17,.84)", cardStyle: "rgba(10,24,22,.86)", cardSoft: "rgba(17,34,30,.68)", borderStyle: "rgba(186,215,202,.15)", borderStrong: "rgba(171,218,194,.32)",
      glowStyle: "0 0 28px rgba(130,191,160,.2)", shadowStyle: "0 18px 52px rgba(0,8,6,.26)", textStyle: "#eef4f0", textMuted: "#82968f", textFaint: "#5e716b", iconStyle: "#b9d9c7",
      barStyle: "rgba(4,13,13,.92)", navStyle: "rgba(11,28,25,.78)", inputStyle: "rgba(4,15,13,.5)", heroOverlay: "rgba(2,10,9,.14)",
    },
  },
  {
    id: "ocean", source: "official", name: "Ocean Depths", eyebrow: "DEEP FOCUS",
    description: "深海、流动水光与安静的矿物蓝。", wallpaper: "/assets/theme-ocean-depths.png",
    heroAlt: "深海水光与远方岩体构成的沉浸空间", mode: "dark",
    colorPalette: { background: "#030c16", primary: "#2f6f88", secondary: "#17374c", accent: "#58aecd", text: "#edf4f8" },
    tokens: {
      background: "#030c16", primaryColor: "#2f6f88", secondaryColor: "#17374c", accentColor: "#58aecd", accentSoft: "#a4d6e8", accentRgb: "88,174,205",
      glassStyle: "rgba(5,16,28,.84)", cardStyle: "rgba(8,21,35,.87)", cardSoft: "rgba(13,29,46,.69)", borderStyle: "rgba(174,211,231,.15)", borderStrong: "rgba(132,207,238,.32)",
      glowStyle: "0 0 28px rgba(88,174,205,.2)", shadowStyle: "0 18px 52px rgba(0,7,16,.28)", textStyle: "#edf4f8", textMuted: "#7e93a2", textFaint: "#586e7d", iconStyle: "#a4d6e8",
      barStyle: "rgba(2,10,19,.93)", navStyle: "rgba(8,24,39,.79)", inputStyle: "rgba(3,14,25,.5)", heroOverlay: "rgba(1,9,17,.12)",
    },
  },
  {
    id: "minimal", source: "official", name: "Minimal White", eyebrow: "QUIET CLARITY",
    description: "暖白、珍珠灰与香槟色空间光。", wallpaper: "/assets/theme-minimal-white.png",
    heroAlt: "暖白未来建筑与柔和光环构成的极简空间", mode: "light",
    colorPalette: { background: "#f3f0e9", primary: "#b18d63", secondary: "#ded6c8", accent: "#8c704f", text: "#24211d" },
    tokens: {
      background: "#f3f0e9", primaryColor: "#b18d63", secondaryColor: "#ded6c8", accentColor: "#8c704f", accentSoft: "#6e573e", accentRgb: "140,112,79",
      glassStyle: "rgba(250,248,243,.82)", cardStyle: "rgba(255,253,248,.86)", cardSoft: "rgba(238,233,224,.72)", borderStyle: "rgba(84,72,58,.14)", borderStrong: "rgba(140,112,79,.34)",
      glowStyle: "0 0 28px rgba(177,141,99,.18)", shadowStyle: "0 18px 52px rgba(84,70,48,.12)", textStyle: "#24211d", textMuted: "#746d64", textFaint: "#9a9187", iconStyle: "#8c704f",
      barStyle: "rgba(246,243,237,.9)", navStyle: "rgba(255,253,248,.76)", inputStyle: "rgba(255,255,255,.62)", heroOverlay: "rgba(255,250,242,.08)",
    },
  },
  {
    id: "future", source: "official", name: "Future City", eyebrow: "NEXT HORIZON",
    description: "矿物蓝、银紫与克制的城市光轨。", wallpaper: "/assets/theme-future-city.png",
    heroAlt: "蓝紫光环与未来城市天际线构成的夜幕空间", mode: "dark",
    colorPalette: { background: "#030817", primary: "#455ed0", secondary: "#222f72", accent: "#7388ff", text: "#eef1ff" },
    tokens: {
      background: "#030817", primaryColor: "#455ed0", secondaryColor: "#222f72", accentColor: "#7388ff", accentSoft: "#b6c1ff", accentRgb: "115,136,255",
      glassStyle: "rgba(5,10,29,.84)", cardStyle: "rgba(9,15,38,.87)", cardSoft: "rgba(18,25,55,.7)", borderStyle: "rgba(185,198,255,.15)", borderStrong: "rgba(139,158,255,.35)",
      glowStyle: "0 0 30px rgba(115,136,255,.24)", shadowStyle: "0 18px 54px rgba(0,3,18,.3)", textStyle: "#eef1ff", textMuted: "#858ca9", textFaint: "#5d6585", iconStyle: "#b6c1ff",
      barStyle: "rgba(2,6,20,.93)", navStyle: "rgba(9,15,40,.8)", inputStyle: "rgba(4,9,27,.54)", heroOverlay: "rgba(2,5,19,.1)",
    },
  },
];

export const themeById = Object.fromEntries(workspaceThemes.map((theme) => [theme.id, theme])) as Record<OfficialThemeId, WorkspaceTheme>;

export function getThemeById(themeId: ThemeId, customThemes: WorkspaceTheme[]) {
  return customThemes.find((theme) => theme.id === themeId) ?? themeById[themeId as OfficialThemeId] ?? themeById.cosmic;
}
