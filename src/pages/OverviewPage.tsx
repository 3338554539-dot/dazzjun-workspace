import { ArrowRight, BookOpen, BrainCircuit, CheckCircle2, Dumbbell, Heart, Languages, Lightbulb, PenLine, Plus, Send, Sparkles, SquareCheckBig, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useAuth } from "../auth";
import { GrowthRings, HabitTracker, YearOverview } from "../components/GrowthDashboard";
import type { PageKey } from "../components/Shell";
import { WorkspaceEmptyState } from "../components/workspace/GrowthUI";
import { useWorkspaceNavigation, type WorkspaceNavigationOptions } from "../components/workspace/WorkspaceNavigation";
import { useWorkspaceStats } from "../hooks/useWorkspaceStats";
import { getGreeting, isBetween, todayISO } from "../services/date";
import { shouldSubmitOnEnter } from "../services/ime";
import { useWorkspaceStore } from "../store/workspaceStore";
import { useWorkspaceTheme } from "../theme";

const pageMotion = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };
type QuickAction = { label: string; detail: string; icon: typeof Plus; page: PageKey; options: WorkspaceNavigationOptions };

export function OverviewPage() {
  const { user } = useAuth();
  const { navigate } = useWorkspaceNavigation();
  const theme = useWorkspaceTheme();
  const stats = useWorkspaceStats();
  const workspace = useWorkspaceStore();
  const [assistantDraft, setAssistantDraft] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const today = todayISO();
  const todayLabel = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date());
  const metrics = [
    { label: "今日任务", value: `${stats.todayTodo.done}/${stats.todayTodo.total}`, meta: `${stats.todayTodo.progress}% 完成`, icon: SquareCheckBig, tone: "violet", page: "todo" as const, options: { filter: "today" } },
    { label: "本周学习", value: `${stats.learningMinutes}`, unit: "min", meta: `目标 ${stats.goals.weeklyLearningMinutes}`, icon: BookOpen, tone: "cyan", page: "learning" as const, options: { filter: "week" } },
    { label: "今日心情", value: stats.moodToday?.mood ?? "待记录", meta: stats.moodToday ? `${stats.moodToday.score} 分状态` : "写下此刻感受", icon: Heart, tone: "warm", page: "mood" as const, options: stats.moodToday ? { recordId: stats.moodToday.id, date: stats.moodToday.date } : { mode: "new", date: today } },
    { label: "本周运动", value: `${stats.fitness.sessions}`, unit: "次", meta: `${stats.fitness.calories} kcal`, icon: Dumbbell, tone: "green", page: "fitness" as const, options: { filter: "week" } },
    { label: "灵感收藏", value: `${stats.inspirationSaved}`, meta: `今日 +${stats.inspirationToday}`, icon: Lightbulb, tone: "yellow", page: "inspiration" as const, options: { filter: "all" } },
    { label: "本周复盘", value: `${stats.reviewCompletion}/4`, meta: `第 ${stats.currentWeek.weekNumber} 周`, icon: CheckCircle2, tone: "blue", page: "weekly" as const, options: { week: stats.currentWeek.weekKey } },
  ];
  const recentRecords = useMemo(() => [
    ...workspace.learning.map((item) => ({ id: item.id, title: item.title, module: "学习", date: item.createdAt, page: "learning" as const, options: { recordId: item.id } })),
    ...workspace.moods.map((item) => ({ id: item.id, title: `${item.mood} · ${item.story || item.note || "心情记录"}`, module: "心情", date: item.updatedAt, page: "mood" as const, options: { recordId: item.id, date: item.date } })),
    ...workspace.fitness.map((item) => ({ id: item.id, title: item.title, module: "健身", date: item.createdAt, page: "fitness" as const, options: { recordId: item.id } })),
    ...workspace.inspirations.map((item) => ({ id: item.id, title: item.title, module: "灵感", date: item.createdAt, page: "inspiration" as const, options: { recordId: item.id } })),
    ...workspace.english.map((item) => ({ id: item.id, title: item.categories.join(" · ") || "英语练习", module: "英语", date: item.updatedAt, page: "english" as const, options: { recordId: item.id } })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [workspace.learning, workspace.moods, workspace.fitness, workspace.inspirations, workspace.english]);
  const weeklyFocus = workspace.todos.filter((item) => !item.done && isBetween(item.scheduleDate, stats.currentWeek.start, stats.currentWeek.end)).sort((a, b) => Number(b.priority === "高") - Number(a.priority === "高") || a.scheduleDate.localeCompare(b.scheduleDate)).slice(0, 3);
  const quickActions: QuickAction[] = [
    { label: "新任务", detail: "安排今天要推进的事", icon: SquareCheckBig, page: "todo", options: { filter: "today", mode: "new" } },
    { label: "记录心情", detail: "留住此刻状态", icon: Heart, page: "mood", options: { mode: "new", date: today } },
    { label: "学习日志", detail: "沉淀知识与附件", icon: BookOpen, page: "learning", options: { mode: "new" } },
    { label: "收藏灵感", detail: "快速保存一个想法", icon: PenLine, page: "inspiration", options: { mode: "capture" } },
    { label: "英语打卡", detail: "延续学习节奏", icon: Languages, page: "english", options: { mode: "new" } },
    { label: "记录运动", detail: "开始一次新训练", icon: Dumbbell, page: "fitness", options: { mode: "new" } },
  ];
  const openQuickAction = (action: QuickAction) => { setQuickCreateOpen(false); navigate(action.page, action.options); };
  const openAI = (prompt = assistantDraft) => { const clean = prompt.trim(); navigate("ai", clean ? { prompt: clean, send: "1" } : undefined); };

  return <div className="os-overview">
    <motion.section className="os-overview-hero" {...pageMotion}>
      <img src={theme.wallpaper} alt={theme.heroAlt}/><div className="os-hero-shade"/>
      <div className="os-hero-copy"><small>PERSONAL DASHBOARD</small><h2>{getGreeting().replace("Dazzjun", user?.displayName ?? "Dazzjun")}</h2><p>{todayLabel}</p><button className="os-hero-start" onClick={() => setQuickCreateOpen(true)}><Sparkles size={14}/>从一件小事开始<ArrowRight size={13}/></button></div>
      <div className="os-hero-progress"><small>今日完成</small><strong>{stats.todayTodo.progress}<i>%</i></strong><span>{stats.todayTodo.total ? `完成 ${stats.todayTodo.done} 项，剩余 ${stats.todayTodo.pending} 项` : "今天还没有安排任务"}</span></div>
    </motion.section>
    <section className="os-metric-grid" aria-label="个人状态指标">{metrics.map((item, index) => <motion.button key={item.label} className={`os-metric-card tone-${item.tone}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .035 }} whileHover={{ y: -2 }} onClick={() => navigate(item.page, item.options)} aria-label={`打开${item.label}`}><ArrowRight className="os-metric-arrow" size={13}/><span><item.icon size={17}/>{item.label}</span><strong>{item.value}{item.unit && <i>{item.unit}</i>}</strong><small>{item.meta}</small></motion.button>)}</section>
    <motion.section className="os-ai-bridge" {...pageMotion} transition={{ delay: .08 }}>
      <div className="os-ai-heading"><span><BrainCircuit size={20}/></span><div><small>DAZZJUN AI ASSISTANT</small><h3>今天想让 AI 和你一起处理什么？</h3></div><i>CONTEXT READY</i></div>
      <div className="os-ai-input"><Sparkles size={17}/><input value={assistantDraft} onChange={(event) => setAssistantDraft(event.target.value)} onKeyDown={(event) => { if (shouldSubmitOnEnter(event.nativeEvent)) openAI(); }} placeholder="总结今天、梳理任务，或给我一个成长建议…"/><button onClick={() => openAI()} aria-label="发送到 AI Core"><Send size={16}/></button></div>
      <div className="os-ai-quick"><button onClick={() => openAI("请总结我今天的状态，并给出一个清晰的下一步建议。")}>总结今日状态</button><button onClick={() => openAI("请根据我今天和本周的任务，帮我梳理优先级。")}>梳理优先任务</button><button onClick={() => openAI("请根据我近期的学习记录，生成一份可执行的学习建议。")}>生成学习建议</button></div>
    </motion.section>
    <section className="os-home-columns">
      <article className="os-home-panel"><header><span>最近记录</span><button onClick={() => setQuickCreateOpen(true)}>开始记录 <Plus size={13}/></button></header><div className="os-recent-list">{recentRecords.length ? recentRecords.map((item) => <button key={`${item.page}-${item.id}`} onClick={() => navigate(item.page, item.options)}><i>{item.module.slice(0,1)}</i><span><strong>{item.title}</strong><small>{item.module} · {item.date.slice(0,10)}</small></span><ArrowRight size={13}/></button>) : <WorkspaceEmptyState icon={Sparkles} title="还没有最近记录" description="第一条记录会成为成长轨迹的起点。" action="开始第一条记录" onAction={() => setQuickCreateOpen(true)}/>}</div></article>
      <article className="os-home-panel"><header><span>本周聚焦</span><button onClick={() => navigate("todo", { filter: "week" })}>查看全部 <ArrowRight size={13}/></button></header><div className="os-focus-list">{weeklyFocus.length ? weeklyFocus.map((item, index) => <button key={item.id} onClick={() => navigate("todo", { filter: "week", taskId: item.id })}><i>{String(index + 1).padStart(2,"0")}</i><span><strong>{item.title}</strong><small>{item.scheduleDate.slice(5)} · {item.category} · {item.priority}优先</small></span></button>) : <WorkspaceEmptyState icon={SquareCheckBig} title="本周暂无聚焦任务" description="给这一周安排一件真正重要的事。" action="创建本周任务" onAction={() => navigate("todo", { filter: "week", mode: "new" })}/>}</div></article>
      <article className="os-home-panel os-quick-record"><header><span>快速记录</span><small>CAPTURE</small></header><div>{quickActions.slice(1).map((action) => <button key={action.label} onClick={() => openQuickAction(action)}><action.icon size={18}/><span>{action.label}<small>{action.detail}</small></span></button>)}</div></article>
    </section>
    <details className="os-longterm-data"><summary>查看长期成长数据</summary><div><GrowthRings values={stats.growth}/><HabitTracker streaks={stats.habitStreaks}/><YearOverview data={stats.year}/></div></details>
    <AnimatePresence>{quickCreateOpen && <motion.div className="os-quick-create-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickCreateOpen(false); }}><motion.aside className="os-quick-create" initial={{ x: 28, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 18, opacity: 0 }}><header><div><small>QUICK CREATE</small><h2>从一件小事开始</h2></div><button onClick={() => setQuickCreateOpen(false)} aria-label="关闭快捷创建"><X size={17}/></button></header><div>{quickActions.map((action) => <button key={action.label} onClick={() => openQuickAction(action)}><action.icon size={19}/><span><strong>{action.label}</strong><small>{action.detail}</small></span><ArrowRight size={14}/></button>)}</div></motion.aside></motion.div>}</AnimatePresence>
  </div>;
}
