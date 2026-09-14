import { Bell, BrainCircuit, Menu, Palette, Search } from "lucide-react";
import { motion } from "framer-motion";
import type { PageKey } from "../Shell";

const pageTitles: Record<PageKey, { title: string; eyebrow: string }> = {
  overview: { title: "首页", eyebrow: "PERSONAL DASHBOARD" },
  todo: { title: "To Do List", eyebrow: "TASK RHYTHM" },
  mood: { title: "心情日记", eyebrow: "MOOD JOURNAL" },
  learning: { title: "学习日志", eyebrow: "LEARNING SPACE" },
  english: { title: "英语学习", eyebrow: "ENGLISH PRACTICE" },
  fitness: { title: "健身锻炼", eyebrow: "FITNESS TRACKER" },
  weekly: { title: "周复盘", eyebrow: "WEEKLY REVIEW" },
  inspiration: { title: "灵感库", eyebrow: "INSPIRATION LIBRARY" },
  ai: { title: "AI Core", eyebrow: "PERSONAL INTELLIGENCE" },
};

export function CommandBar({ active, onSearch, onAI, onTheme, onInsight }: {
  active: PageKey;
  onSearch: () => void;
  onAI: () => void;
  onTheme: () => void;
  onInsight: () => void;
}) {
  const page = pageTitles[active];
  return (
    <header className="os-commandbar">
      <div className="os-mobile-title"><Menu size={18}/><strong>Dazzjun</strong></div>
      <div className="os-command-title"><small>{page.eyebrow}</small><h1>{page.title}</h1></div>
      <button className="os-command-search" onClick={onSearch} aria-label="打开全局搜索"><Search size={17}/><span>搜索工作台</span><kbd>⌘ K</kbd></button>
      <div className="os-command-actions">
        <motion.button whileTap={{ scale: .95 }} className={active === "ai" ? "active" : ""} onClick={onAI} aria-label="打开 AI Core"><BrainCircuit size={18}/><span>AI Core</span></motion.button>
        <motion.button whileTap={{ scale: .95 }} onClick={onTheme} aria-label="切换主题"><Palette size={18}/></motion.button>
        <motion.button whileTap={{ scale: .95 }} onClick={onInsight} aria-label="查看智能状态"><Bell size={18}/><i/></motion.button>
      </div>
    </header>
  );
}
