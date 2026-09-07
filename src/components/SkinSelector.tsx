import { AnimatePresence, motion } from "framer-motion";
import { Check, Palette, Trash2, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { useThemeStore, workspaceThemes, type WorkspaceTheme } from "../theme";
import { CustomThemeUploader } from "./CustomThemeUploader";

function ThemePreview({ theme, selected, onSelect, onDelete }: { theme: WorkspaceTheme; selected: boolean; onSelect: () => void; onDelete?: () => void }) {
  return <motion.article whileHover={{ y: -3 }} className={`theme-preview-card ${selected ? "selected" : ""}`}>
    <button className="theme-preview-select" onClick={onSelect} aria-pressed={selected}>
      <span className="skin-preview"><img src={theme.wallpaper} alt=""/><i style={{ background: theme.tokens.accentColor }}/>{selected && <b><Check size={13}/></b>}</span>
      <span className="skin-copy"><small>{theme.eyebrow}</small><strong>{theme.name}</strong><em>{theme.description}</em><span className="palette-dots">{Object.values(theme.colorPalette).slice(0, 4).map((color) => <i key={color} style={{ background: color }}/>)}</span></span>
    </button>
    {onDelete && <button className="delete-theme" onClick={onDelete} aria-label={`删除自定义主题 ${theme.name}`}><Trash2 size={14}/></button>}
  </motion.article>;
}

export function SkinSelector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const themeId = useThemeStore((state) => state.themeId);
  const customThemes = useThemeStore((state) => state.customThemes);
  const setTheme = useThemeStore((state) => state.setTheme);
  const deleteCustomTheme = useThemeStore((state) => state.deleteCustomTheme);
  const previewRail = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const rail = previewRail.current;
    const selected = rail?.querySelector<HTMLElement>(".theme-preview-card.selected");
    if (!rail || !selected || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollLeft = selected.offsetLeft - (rail.clientWidth - selected.offsetWidth) / 2;
  }, [open, themeId]);

  const removeTheme = (theme: WorkspaceTheme) => {
    if (window.confirm(`删除「${theme.name}」吗？壁纸和自动生成的配色会从此设备移除。`)) deleteCustomTheme(theme.id);
  };

  return <AnimatePresence>{open && <motion.aside className="skin-selector theme-center" initial={{ opacity: 0, y: -10, scale: .98, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6, scale: .985, filter: "blur(6px)" }} transition={{ duration: .32, ease: [0.22, 1, 0.36, 1] }} aria-label="Theme Center">
    <header><span><Palette size={16}/><i><strong>Theme Center</strong><small>让整个 Dazzjun 成为你的视觉世界</small></i></span><button onClick={onClose} aria-label="关闭主题中心"><X size={16}/></button></header>
    <section className="theme-section"><div className="theme-section-title"><span>OFFICIAL THEMES</span><small>{workspaceThemes.length} 个完整主题</small></div><div className="skin-grid" ref={previewRail}>{workspaceThemes.map((theme) => <ThemePreview key={theme.id} theme={theme} selected={theme.id === themeId} onSelect={() => setTheme(theme.id)}/>)}</div></section>
    <section className="theme-section custom-theme-section"><div className="theme-section-title"><span>MY THEMES</span><small>{customThemes.length ? `${customThemes.length} 个专属空间` : "从一张图片开始"}</small></div><CustomThemeUploader/>{customThemes.length > 0 && <div className="custom-theme-grid">{customThemes.map((theme) => <ThemePreview key={theme.id} theme={theme} selected={theme.id === themeId} onSelect={() => setTheme(theme.id)} onDelete={() => removeTheme(theme)}/>)}</div>}</section>
    <footer><span>LOCAL-FIRST THEME ENGINE</span><i>图片仅保存在此设备</i><i>自动色彩分析</i><i>全局组件同步</i></footer>
  </motion.aside>}</AnimatePresence>;
}
