import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Brain,
  BrainCircuit,
  Command,
  Download,
  Dumbbell,
  Flame,
  Heart,
  Languages,
  Lightbulb,
  Moon,
  Palette,
  PenLine,
  Play,
  Plus,
  RefreshCw,
  Scan,
  Search,
  Smile,
  Sparkles,
  SquareCheckBig,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DazzjunMark, IntelligenceNodeIcon, SearchNodeIcon, SpaceSwitchIcon } from "./DazzjunBrand";
import { ProfilePanel } from "./ProfilePanel";
import { SkinSelector } from "./SkinSelector";
import { useAccountData, useAuth } from "../auth";
import type { WorkspaceData } from "../data/types";
import { useWorkspaceStats } from "../hooks/useWorkspaceStats";
import { exportWorkspaceBackup, parseWorkspaceBackup } from "../services/backup";
import { getGreeting, todayISO, toISODate } from "../services/date";
import { isIMEComposing, shouldSubmitOnEnter } from "../services/ime";
import { searchWorkspace, type SearchTarget } from "../services/search";
import { todoTimingFromStart } from "../services/todoSelectors";
import { useWorkspaceStore } from "../store/workspaceStore";
import { applyPWAUpdate } from "../pwa/update";
import { useWorkspaceTheme } from "../theme";

export type PageKey = "overview" | "todo" | "mood" | "learning" | "english" | "fitness" | "weekly" | "inspiration" | "ai";

type NavItem = { id: Exclude<PageKey, "overview">; label: string; status: string; icon: typeof SquareCheckBig };

const resultIcons: Record<SearchTarget, typeof SquareCheckBig> = { todo: SquareCheckBig, mood: Heart, learning: BookOpen, english: Languages, fitness: Dumbbell, weekly: Brain, inspiration: Lightbulb, ai: BrainCircuit };

export function AppShell({ active, onNavigate, children }: { active: PageKey; onNavigate: (page: PageKey) => void; children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [quickTask, setQuickTask] = useState("");
  const [dataNotice, setDataNotice] = useState("");
  const [identityOpen, setIdentityOpen] = useState(false);
  const [skinOpen, setSkinOpen] = useState(false);
  const [pwaUpdateAvailable, setPwaUpdateAvailable] = useState(false);
  const [pwaUpdating, setPwaUpdating] = useState(false);
  const backupInput = useRef<HTMLInputElement>(null);
  const workspace = useWorkspaceStore();
  const { user } = useAuth();
  const { syncStatus } = useAccountData();
  const theme = useWorkspaceTheme();
  const stats = useWorkspaceStats();
  const workspaceData: WorkspaceData = { todos: workspace.todos, moods: workspace.moods, learning: workspace.learning, english: workspace.english, fitness: workspace.fitness, weeklyReviews: workspace.weeklyReviews, inspirations: workspace.inspirations, inspirationCategories: workspace.inspirationCategories, inspirationNotes: workspace.inspirationNotes, inspirationTags: workspace.inspirationTags, habitCompletions: workspace.habitCompletions, inspirationLinks: workspace.inspirationLinks, aiInsights: workspace.aiInsights, knowledgeLinks: workspace.knowledgeLinks, memories: workspace.memories, usageEvents: workspace.usageEvents, aiNotifications: workspace.aiNotifications, goals: workspace.goals };
  const navItems: NavItem[] = [
    { id: "todo", label: "To Do List", status: `进行中 ${stats.todo.pending}`, icon: SquareCheckBig },
    { id: "mood", label: "心情日记", status: stats.moodToday ? "今日已记录" : "今日待记录", icon: Heart },
    { id: "learning", label: "学习日志", status: `本周 ${stats.learningMinutes}m`, icon: BookOpen },
    { id: "english", label: "英语学习", status: `连续打卡 ${stats.englishStreak} 天`, icon: Languages },
    { id: "fitness", label: "健身锻炼", status: `本周 ${stats.fitness.sessions} 次`, icon: Dumbbell },
    { id: "weekly", label: "周复盘", status: `第 ${stats.currentWeek.weekNumber} 周 · ${stats.reviewCompletion}/4`, icon: Brain },
    { id: "inspiration", label: "灵感库", status: `收藏 ${stats.inspirationSaved} · 今日 +${stats.inspirationToday}`, icon: Lightbulb },
  ];
  const results = useMemo(() => searchWorkspace(workspaceData, query), [query, workspace.todos, workspace.moods, workspace.learning, workspace.english, workspace.fitness, workspace.weeklyReviews, workspace.inspirations, workspace.inspirationCategories, workspace.inspirationNotes, workspace.inspirationTags, workspace.habitCompletions, workspace.inspirationLinks, workspace.aiInsights, workspace.knowledgeLinks, workspace.memories, workspace.goals]);

  const closeCommand = () => { setSearchOpen(false); setQuery(""); setQuickTaskOpen(false); setQuickTask(""); };
  const closeOverlays = () => { closeCommand(); setSkinOpen(false); setIdentityOpen(false); };
  const go = (page: PageKey) => { onNavigate(page); closeCommand(); };
  const saveQuickTask = () => {
    if (!quickTask.trim()) return;
    const now = new Date();
    const today = todayISO();
    const start = `${today}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const due = new Date(now.getTime() + 60 * 60 * 1000);
    const deadline = `${toISODate(due)}T${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
    workspace.addTodo({ title: quickTask.trim(), category: "生活", priority: "中", ...todoTimingFromStart(start, deadline, today) });
    setQuickTask(""); setQuickTaskOpen(false);
  };
  const restoreBackup = async (file?: File) => {
    if (!file) return;
    try {
      const restored = parseWorkspaceBackup(await file.text());
      if (!window.confirm("恢复备份会用文件中的内容替换当前工作台数据。确认继续吗？")) return;
      workspace.restoreWorkspace(restored);
      setDataNotice("数据已完整恢复");
      window.setTimeout(() => setDataNotice(""), 2600);
    } catch (error) {
      setDataNotice(error instanceof Error ? error.message : "恢复失败");
    } finally {
      if (backupInput.current) backupInput.current.value = "";
    }
  };

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (isIMEComposing(event)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") closeOverlays();
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    const onUpdate = () => setPwaUpdateAvailable(true);
    window.addEventListener("dazzjun:pwa-update", onUpdate);
    return () => window.removeEventListener("dazzjun:pwa-update", onUpdate);
  }, []);

  const updatePWA = async () => {
    setPwaUpdating(true);
    await applyPWAUpdate();
  };

  return (
    <div className="app-stage">
      <div className="app-window">
        <header className="window-bar">
          <div className="window-left"><button className="window-title" onClick={() => onNavigate("overview")} aria-label="返回 Dazzjun 工作台首页"><DazzjunMark/><span><strong>Dazzjun</strong><small>PERSONAL WORKSPACE</small></span></button></div>
          <div className="window-actions">
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: .97 }} className="search-pill" onClick={() => setSearchOpen(true)} aria-label="打开全局搜索"><SearchNodeIcon/><span>搜索一切...</span><kbd>⌘ K</kbd></motion.button>
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: .95 }} className={`intelligence-entry ${active === "ai" ? "active" : ""}`} onClick={() => onNavigate("ai")} aria-label="打开 Dazzjun AI Assistant"><IntelligenceNodeIcon/><span>AI CORE</span><i/></motion.button>
            <div className="command-node-group" aria-label="Dazzjun Command Center">
              <motion.button whileHover={{ y: -3 }} whileTap={{ scale: .95 }} className={`command-node skin-node ${skinOpen ? "open" : ""}`} onClick={() => { setSkinOpen(!skinOpen); setIdentityOpen(false); }} aria-label="打开皮肤与壁纸" aria-expanded={skinOpen} title="皮肤 / Wallpaper"><Palette/><span className="node-label">皮肤</span></motion.button>
              <motion.button whileHover={{ y: -3 }} whileTap={{ scale: .95 }} className="command-node intelligence-node" onClick={() => { setDataNotice("Dazzjun Intelligence 正在持续感知你的成长轨迹"); window.setTimeout(() => setDataNotice(""), 2600); }} aria-label="Dazzjun 智能感知" title="智能感知"><IntelligenceNodeIcon/><i className="signal-dot"/><span className="node-label">感知</span></motion.button>
              <motion.button whileHover={{ y: -3 }} whileTap={{ scale: .95 }} className="command-node identity-node" onClick={() => { setIdentityOpen(!identityOpen); setSkinOpen(false); }} aria-label={`打开 ${user?.displayName ?? "Dazzjun"} 的个人主页`} aria-expanded={identityOpen}><span className="identity-initial">{user?.displayName.slice(0, 1).toUpperCase() ?? <DazzjunMark/>}</span><span className="node-label">账户</span></motion.button>
              <motion.button whileHover={{ y: -3 }} whileTap={{ scale: .95 }} className={`command-node space-switch ${identityOpen ? "open" : ""}`} onClick={() => { setIdentityOpen(!identityOpen); setSkinOpen(false); }} aria-label="展开空间控制" aria-expanded={identityOpen}><SpaceSwitchIcon/><span className="node-label">空间</span></motion.button>
            </div>
            <input ref={backupInput} className="backup-file-input" type="file" accept="application/json,.json" onChange={(event) => restoreBackup(event.target.files?.[0])}/>
            <ProfilePanel open={identityOpen} onClose={() => setIdentityOpen(false)}/>
            <SkinSelector open={skinOpen} onClose={() => setSkinOpen(false)}/>
          </div>
        </header>

        <section className="hero" aria-label="Dazzjun 品牌空间">
          <AnimatePresence mode="sync" initial={false}>
            <motion.img key={theme.id} className="hero-art" src={theme.wallpaper} alt={theme.heroAlt} initial={{ opacity: 0, scale: 1.018, filter: "blur(10px)" }} animate={{ opacity: .95, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 1.008, filter: "blur(8px)" }} transition={{ duration: .5, ease: [0.22, 1, 0.36, 1] }}/>
          </AnimatePresence>
          <div className="hero-copy"><button className="brand-button" onClick={() => onNavigate("overview")}><span className="hero-brand-lockup"><DazzjunMark/><span className="brand-name">Dazzjun</span></span><span className="brand-subtitle">PERSONAL CREATIVE WORKSPACE</span><span className="brand-tagline">记录生活，创造灵感，持续成长。</span><span className="brand-greeting">{getGreeting()}</span></button></div>
        </section>

        <nav className="module-nav" aria-label="工作台模块"><div className="nav-track">{navItems.map((item) => { const Icon = item.icon; const selected = active === item.id; return <motion.button whileHover={{ y: -3 }} whileTap={{ scale: .98 }} className={`nav-item ${selected ? "active" : ""}`} key={item.id} onClick={() => onNavigate(item.id)}><Icon size={25} strokeWidth={1.6}/><span className="nav-copy"><strong>{item.label}</strong><small>{item.status}</small></span></motion.button>; })}</div></nav>

        <main className="workspace-content">{children}</main>

        <footer className="status-bar"><span><Moon size={14}/>深色模式</span><span><Scan size={14}/>{syncStatus === "saved" ? "账户已同步" : syncStatus === "saving" ? "同步中" : "连接待检查"}</span><p><Sparkles size={15}/>保持专注，持续行动，你正在成为更好的自己。</p><span className="streak"><Flame size={14}/>英语连续 <b>{stats.englishStreak} 天</b></span><time dateTime={todayISO()}>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date())}</time></footer>
        <motion.button whileTap={{ scale: .92 }} className="mobile-command-button" onClick={() => setSearchOpen(true)} aria-label="打开快捷操作"><Plus size={22}/></motion.button>
      </div>

      <AnimatePresence>
        {searchOpen && <motion.div className="search-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeCommand}>
          <motion.div className="command-menu command-center" initial={{ y: -20, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -10, opacity: 0 }} onClick={(event) => event.stopPropagation()}>
            <header><span><Command size={14}/>DAZZJUN COMMAND CENTER</span><button onClick={closeCommand}><X size={17}/></button></header>
            <div className="command-input"><Search size={18}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务、日记、学习、健身、复盘或灵感..."/><kbd>ESC</kbd></div>
            {!query && <><div className="quick-actions"><button onClick={() => setQuickTaskOpen(!quickTaskOpen)}><Plus size={17}/><span>新增任务<small>直接写入今日清单</small></span></button><button onClick={() => go("mood")}><Smile size={17}/><span>记录心情<small>留住今日状态</small></span></button><button onClick={() => go("inspiration")}><PenLine size={17}/><span>添加灵感<small>进入创意数据库</small></span></button><button onClick={() => go("learning")}><Play size={17}/><span>开始学习<small>记录专注时间</small></span></button><button className="ai-quick" onClick={() => go("ai")}><BrainCircuit size={17}/><span>调用 AI<small>总结、连接与建议</small></span></button></div>{quickTaskOpen && <motion.div className="quick-task-entry" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}><SquareCheckBig size={17}/><input autoFocus value={quickTask} onChange={(event) => setQuickTask(event.target.value)} onKeyDown={(event) => { if (shouldSubmitOnEnter(event.nativeEvent)) saveQuickTask(); }} placeholder="输入任务，按 Enter 保存"/><button onClick={saveQuickTask}>添加</button></motion.div>}</>}
            <div className="command-results advanced">{query ? results.length ? results.map((item) => { const Icon = resultIcons[item.page]; return <button key={item.id} onClick={() => go(item.page)}><Icon size={18}/><span><strong>{item.title}</strong><small>{item.module} · {item.detail}</small></span><ArrowUpRight size={14}/></button>; }) : <div className="command-empty">没有找到与“{query}”相关的个人记录</div> : <div className="command-hint"><BrainCircuit size={17}/><span><strong>Dazzjun AI Core 已启用</strong><small>可生成每日、每周、月度与年度成长报告</small></span></div>}</div>
            <footer><div><button onClick={() => exportWorkspaceBackup(workspaceData)}><Download size={14}/>完整导出</button><button onClick={() => backupInput.current?.click()}><Upload size={14}/>恢复备份</button></div><span>搜索覆盖七大成长模块</span></footer>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
      <AnimatePresence>{dataNotice && <motion.div className="data-notice" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{dataNotice}</motion.div>}</AnimatePresence>
      <AnimatePresence>{pwaUpdateAvailable && <motion.aside className="pwa-update-notice" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><DazzjunMark/><span><strong>新的 Dazzjun 空间已准备好</strong><small>安全更新后会自动回到当前工作台。</small></span><button disabled={pwaUpdating} onClick={updatePWA}><RefreshCw size={13}/>{pwaUpdating ? "更新中" : "安全更新"}</button></motion.aside>}</AnimatePresence>
    </div>
  );
}
