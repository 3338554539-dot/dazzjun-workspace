import type { ThemePalette, WorkspaceTheme } from "./types";

type RGB = { r: number; g: number; b: number };

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const hex = ({ r, g, b }: RGB) => `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: RGB, b: RGB, amount: number): RGB => ({ r: a.r + (b.r - a.r) * amount, g: a.g + (b.g - a.g) * amount, b: a.b + (b.b - a.b) * amount });
const luminance = ({ r, g, b }: RGB) => (.2126 * r + .7152 * g + .0722 * b) / 255;
const saturation = ({ r, g, b }: RGB) => {
  const high = Math.max(r, g, b); const low = Math.min(r, g, b);
  return high === 0 ? 0 : (high - low) / high;
};
const rgba = (color: RGB, alpha: number) => `rgba(${clamp(color.r)},${clamp(color.g)},${clamp(color.b)},${alpha})`;

function analyzePixels(data: Uint8ClampedArray) {
  const colors: RGB[] = [];
  for (let index = 0; index < data.length; index += 16) {
    if (data[index + 3] < 180) continue;
    colors.push({ r: data[index], g: data[index + 1], b: data[index + 2] });
  }
  const average = colors.reduce((sum, color) => ({ r: sum.r + color.r, g: sum.g + color.g, b: sum.b + color.b }), { r: 0, g: 0, b: 0 });
  const base = colors.length ? { r: average.r / colors.length, g: average.g / colors.length, b: average.b / colors.length } : { r: 82, g: 72, b: 118 };
  const candidates = colors.filter((color) => luminance(color) > .22 && luminance(color) < .82).sort((a, b) => saturation(b) * .7 + luminance(b) * .3 - (saturation(a) * .7 + luminance(a) * .3));
  let accent = candidates[Math.floor(candidates.length * .08)] ?? base;
  if (saturation(accent) < .22) accent = mix(accent, accent.b > accent.r ? { r: 90, g: 130, b: 230 } : { r: 174, g: 108, b: 212 }, .48);
  return { base, accent };
}

function themeName(accent: RGB) {
  if (accent.g > accent.r * 1.13 && accent.g > accent.b * .92) return "Forest Atelier";
  if (accent.b > accent.r * 1.18) return "Ocean Atelier";
  if (accent.r > accent.g * 1.2 && accent.r > accent.b * 1.08) return "Ember Atelier";
  return "Private Atelier";
}

export async function createCustomTheme(file: File): Promise<WorkspaceTheme> {
  if (!file.type.startsWith("image/")) throw new Error("请选择 JPG、PNG 或 WebP 图片");
  if (file.size > 12 * 1024 * 1024) throw new Error("图片请控制在 12MB 以内");

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.src = objectUrl;
  try {
    await image.decode();

    const sample = document.createElement("canvas");
    sample.width = 56; sample.height = 56;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    if (!sampleContext) throw new Error("当前浏览器无法分析这张图片");
    sampleContext.drawImage(image, 0, 0, sample.width, sample.height);
    const { base, accent: sourceAccent } = analyzePixels(sampleContext.getImageData(0, 0, sample.width, sample.height).data);
    const light = luminance(base) > .66;

    const maxWidth = 1800;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const wallpaperCanvas = document.createElement("canvas");
    wallpaperCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    wallpaperCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const wallpaperContext = wallpaperCanvas.getContext("2d");
    if (!wallpaperContext) throw new Error("当前浏览器无法处理这张图片");
    wallpaperContext.fillStyle = light ? "#faf9f6" : "#03060c";
    wallpaperContext.fillRect(0, 0, wallpaperCanvas.width, wallpaperCanvas.height);
    wallpaperContext.drawImage(image, 0, 0, wallpaperCanvas.width, wallpaperCanvas.height);
    const wallpaper = wallpaperCanvas.toDataURL("image/jpeg", .8);

    const accent = light ? mix(sourceAccent, { r: 24, g: 26, b: 32 }, .36) : mix(sourceAccent, { r: 238, g: 242, b: 255 }, .2);
    const primary = light ? mix(base, accent, .34) : mix(base, accent, .48);
    const secondary = light ? mix(base, { r: 255, g: 255, b: 255 }, .62) : mix(base, { r: 7, g: 10, b: 18 }, .58);
    const background = light ? mix(base, { r: 249, g: 248, b: 245 }, .8) : mix(base, { r: 2, g: 5, b: 12 }, .84);
    const text = light ? { r: 29, g: 29, b: 31 } : { r: 239, g: 242, b: 248 };
    const accentRgb = `${clamp(accent.r)},${clamp(accent.g)},${clamp(accent.b)}`;
    const palette: ThemePalette = { background: hex(background), primary: hex(primary), secondary: hex(secondary), accent: hex(accent), text: hex(text) };

    return {
      id: `custom-${crypto.randomUUID()}`, source: "custom", name: themeName(sourceAccent), eyebrow: "MY THEME",
      description: "由你的图片在本地生成的专属 Dazzjun 视觉语言。", wallpaper,
      heroAlt: `用户自定义主题：${file.name}`, mode: light ? "light" : "dark", colorPalette: palette, createdTime: new Date().toISOString(),
      tokens: {
        background: palette.background, primaryColor: palette.primary, secondaryColor: palette.secondary, accentColor: palette.accent,
        accentSoft: hex(light ? mix(accent, { r: 20, g: 22, b: 26 }, .22) : mix(accent, { r: 255, g: 255, b: 255 }, .48)), accentRgb,
        glassStyle: rgba(light ? mix(base, { r: 255, g: 255, b: 255 }, .84) : mix(base, { r: 3, g: 7, b: 13 }, .72), .86),
        cardStyle: rgba(light ? mix(base, { r: 255, g: 255, b: 255 }, .88) : mix(base, { r: 6, g: 10, b: 17 }, .68), .88),
        cardSoft: rgba(light ? mix(base, { r: 245, g: 244, b: 240 }, .72) : mix(base, { r: 12, g: 17, b: 25 }, .56), .72),
        borderStyle: rgba(light ? mix(base, { r: 45, g: 45, b: 48 }, .35) : mix(base, { r: 230, g: 237, b: 247 }, .66), .16),
        borderStrong: rgba(accent, .38), glowStyle: `0 0 30px ${rgba(accent, .24)}`, shadowStyle: `0 18px 54px ${light ? "rgba(34,30,24,.12)" : "rgba(0,0,0,.28)"}`,
        textStyle: palette.text, textMuted: light ? "#746f69" : "#87909e", textFaint: light ? "#9a938a" : "#5e6877", iconStyle: hex(accent),
        barStyle: rgba(background, .93), navStyle: rgba(light ? mix(background, { r: 255, g: 255, b: 255 }, .62) : mix(background, primary, .18), .82),
        inputStyle: rgba(light ? { r: 255, g: 255, b: 255 } : mix(background, { r: 0, g: 0, b: 0 }, .25), .56), heroOverlay: light ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.12)",
      },
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
