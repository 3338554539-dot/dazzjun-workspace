import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Brain,
  BrainCircuit,
  Command,
  Download,
  Dumbbell,
  Heart,
  Languages,
  Lightbulb,
  PenLine,
  Play,
  Plus,
  RefreshCw,
  Search,
  Smile,
  Sparkles,
  SquareCheckBig,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DazzjunMark } from "./DazzjunBrand";
import { ProfilePanel } from "./ProfilePanel";
import { SkinSelector } from "./SkinSelector";
import { CommandBar } from "./workspace/CommandBar";
import { ContextRail } from "./workspace/ContextRail";
import { MobileNavigation } from "./workspace/MobileNavigation";
import { Sidebar } from "./workspace/Sidebar";
import { WorkspaceNavigationProvider } from "./workspace/WorkspaceNavigation";
import type { WorkspaceNavigate } from "./workspace/WorkspaceNavigation";
import type { WorkspaceNavItem } from "./workspace/types";
import { useAuth } from "../auth";
import type { WorkspaceData } from "../data/types";
import { useWorkspaceStats } from "../hooks/useWorkspaceStats";
import { exportWorkspaceBackup, parseWorkspaceBackup } from "../services/backup";
import { todayISO, toISODate } from "../services/date";
import { isIMEComposing, shouldSubmitOnEnter } from "../services/ime";
import { searchWorkspace, type SearchTarget } from "../services/search";
import { todoTimingFromStart } from "../services/todoSelectors";
import { useWorkspaceStore } from "../store/workspaceStore";
import { applyPWAUpdate } from "../pwa/update";

export type PageKey = "overview" | "todo" | "mood" | "learning" | "english" | "fitness" | "weekly" | "inspiration" | "ai";

const resultIcons: Record<SearchTarget, typeof SquareCheckBig> = { todo: SquareCheckBig, mood: Heart, learning: BookOpen, english: Languages, fitness: Dumbbell, weekly: Brain, inspiration: Lightbulb, ai: BrainCircuit };

export function WorkspaceShell({ active, onNavigate, locationKey, children }: { active: PageKey; onNavigate: WorkspaceNavigate; locationKey: string; children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [quickTask, setQuickTask] = useState("");
  const [dataNotice, setDataNotice] = useState("");
  const [identityOpen, setIdentityOpen] = useState(false);
  const [skinOpen, setSkinOpen] = useState(false);
  const [pwaUpdateAvailable, setPwaUpdateAvailable] = useState(false);
  const [pwaUpdating, setPwaUpdating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const backupInput = useRef<HTMLInputElement>(null);
  const workspace = useWorkspaceStore();
  const { user } = useAuth();
  const stats = useWorkspaceStats();
  const workspaceData: WorkspaceData = { todos: workspace.todos, moods: workspace.moods, learning: workspace.learning, english: workspace.english, fitness: workspace.fitness, weeklyReviews: workspace.weeklyReviews, inspirations: workspace.inspirations, inspirationCategories: workspace.inspirationCategories, inspirationNotes: workspace.inspirationNotes, inspirationTags: workspace.inspirationTags, habitCompletions: workspace.habitCompletions, inspirationLinks: workspace.inspirationLinks, aiInsights: workspace.aiInsights, knowledgeLinks: workspace.knowledgeLinks, memories: workspace.memories, usageEvents: workspace.usageEvents, aiNotifications: workspace.aiNotifications, goals: workspace.goals };
  const navItems: WorkspaceNavItem[] = [
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
    if (!identityOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".profile-panel, .os-sidebar-account, .os-mobile-account")) return;
      setIdentityOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [identityOpen]);

  useEffect(() => {
    const onUpdate = () => setPwaUpdateAvailable(true);
    window.addEventListener("dazzjun:pwa-update", onUpdate);
    return () => window.removeEventListener("dazzjun:pwa-update", onUpdate);
  }, []);

  const updatePWA = async () => {
    setPwaUpdating(true);
    await applyPWAUpdate();
  };
  const hasContextRail = active === "overview" || active === "todo" || active === "mood" || active === "learning" || active === "english" || active === "fitness";

  return (
    <div className="app-stage">
      <WorkspaceNavigationProvider active={active} navigate={onNavigate} locationKey={locationKey}>
      <div className={`workspace-shell-v9 ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
        <Sidebar active={active} collapsed={sidebarCollapsed} displayName={user?.displayName ?? "Dazzjun"} items={navItems} onNavigate={onNavigate} onSearch={() => setSearchOpen(true)} onSettings={() => { setSkinOpen(true); setIdentityOpen(false); }} onAccount={() => { setIdentityOpen((value) => !value); setSkinOpen(false); }} onToggle={() => setSidebarCollapsed((value) => !value)}/>
        <div className="os-workspace-frame">
          <CommandBar active={active} onSearch={() => setSearchOpen(true)} onAI={() => onNavigate("ai")} onTheme={() => { setSkinOpen(!skinOpen); setIdentityOpen(false); }} onInsight={() => { setDataNotice("Dazzjun Intelligence 正在持续感知你的成长轨迹"); window.setTimeout(() => setDataNotice(""), 2600); }}/>
          <div className={`os-workspace-body ${hasContextRail && !railCollapsed ? "with-context-rail" : ""}`}>
            <main className="workspace-content os-workspace-content">{children}</main>
            <ContextRail active={active} collapsed={railCollapsed} onCollapse={() => setRailCollapsed(true)} onNavigate={onNavigate}/>
            {railCollapsed && hasContextRail && <button className="os-rail-reopen" onClick={() => setRailCollapsed(false)} aria-label="展开状态栏"><Sparkles size={16}/></button>}
          </div>
        </div>
        <MobileNavigation active={active} onNavigate={onNavigate} onAccount={() => { setIdentityOpen(true); setSkinOpen(false); }} onSettings={() => { setSkinOpen(true); setIdentityOpen(false); }}/>
        <div className="os-overlay-anchor">
          <input ref={backupInput} className="backup-file-input" type="file" accept="application/json,.json" onChange={(event) => restoreBackup(event.target.files?.[0])}/>
          <ProfilePanel open={identityOpen} onClose={() => setIdentityOpen(false)}/>
          <SkinSelector open={skinOpen} onClose={() => setSkinOpen(false)}/>
        </div>
      </div>
      </WorkspaceNavigationProvider>

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

export const AppShell = WorkspaceShell;
