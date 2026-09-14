import { ArrowRight, BarChart3, BookOpen, BrainCircuit, CalendarDays, Check, ChevronRight, Dumbbell, Flame, Languages, Lightbulb, Quote, Sparkles, Target, Timer, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { inspirationApi, type DailyInspiration } from "../../api/client";
import { useWorkspaceStats } from "../../hooks/useWorkspaceStats";
import { inspirationCoverCandidates, inspirationSourceLabel } from "../../services/inspirationLibrary";
import { todayISO } from "../../services/date";
import { fitnessGrowthStats, learningGrowthStats, moodGrowthStats } from "../../services/growthModules";
import { learningBlocksForEntry } from "../../services/learningBlocks";
import { englishMinutesThisWeek, englishStreak } from "../../services/analytics";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { RailCTA } from "./GrowthUI";
import type { PageKey } from "../Shell";
import type { WorkspaceNavigate } from "./WorkspaceNavigation";

function MonthCalendar({ onSelect }: { onSelect: (date: string) => void }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: offset + days }, (_, index) => index < offset ? null : index - offset + 1);
  return (
    <section className="os-rail-card os-calendar-card">
      <header><span><CalendarDays size={16}/>日历</span><time>{year}.{String(month + 1).padStart(2, "0")}</time></header>
      <div className="os-calendar-week">{["一","二","三","四","五","六","日"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="os-calendar-days">{cells.map((day, index) => day ? <button key={`${day}-${index}`} className={day === now.getDate() ? "today" : ""} onClick={() => onSelect(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`)} aria-label={`查看 ${month + 1} 月 ${day} 日任务`}>{day}</button> : <i key={`empty-${index}`}/>)}</div>
    </section>
  );
}

function InspirationCard({ onNavigate }: { onNavigate: WorkspaceNavigate }) {
  const [item, setItem] = useState<DailyInspiration | null>();
  const [coverIndex, setCoverIndex] = useState(0);
  useEffect(() => {
    let live = true;
    inspirationApi.random().then((value) => { if (live) setItem(value); }).catch(() => { if (live) setItem(null); });
    return () => { live = false; };
  }, []);
  const covers = item ? inspirationCoverCandidates(item, false) : [];
  return (
    <section className="os-rail-card os-rail-inspiration actionable" role="button" tabIndex={0} aria-label={item ? `打开灵感：${item.title}` : "去收藏第一条灵感"} onClick={() => onNavigate("inspiration", item ? { recordId: item.id } : { mode: "capture" })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onNavigate("inspiration", item ? { recordId: item.id } : { mode: "capture" }); } }}>
      <header><span><Lightbulb size={16}/>今日灵感</span><Sparkles size={14}/></header>
      {item === undefined ? <div className="os-rail-skeleton"/> : item ? <>
        {covers[coverIndex] ? <img src={covers[coverIndex]} alt="" onError={() => setCoverIndex((value) => value + 1)}/> : <div className="os-rail-cover-empty"><Lightbulb size={22}/></div>}
        <strong>{item.title}</strong><small>{inspirationSourceLabel(item.platform)} · {item.category_name}</small>
      </> : <div className="os-rail-empty"><Lightbulb size={20}/><span>暂无灵感<br/>去灵感库收藏第一条</span></div>}
    </section>
  );
}

export function ContextRail({ active, collapsed, onCollapse, onNavigate }: {
  active: PageKey;
  collapsed: boolean;
  onCollapse: () => void;
  onNavigate: WorkspaceNavigate;
}) {
  const stats = useWorkspaceStats();
  const moods = useWorkspaceStore((state) => state.moods);
  const learning = useWorkspaceStore((state) => state.learning);
  const english = useWorkspaceStore((state) => state.english);
  const fitness = useWorkspaceStore((state) => state.fitness);
  const goals = useWorkspaceStore((state) => state.goals);
  const today = todayISO();
  const todayTasks = stats.todayTasks.slice().sort((a, b) => a.startAt.localeCompare(b.startAt));
  const highPriority = stats.todayTasks.filter((task) => task.priority === "高" && !task.done);
  const rhythm = useMemo(() => {
    const buckets = { morning: 0, afternoon: 0, evening: 0 };
    todayTasks.forEach((task) => {
      const hour = Number(task.startAt.slice(11, 13));
      if (hour < 12) buckets.morning += 1;
      else if (hour < 18) buckets.afternoon += 1;
      else buckets.evening += 1;
    });
    return buckets;
  }, [todayTasks]);
  const growthPages = ["mood", "learning", "english", "fitness"] as const;
  if (collapsed || (active !== "overview" && active !== "todo" && !growthPages.includes(active as typeof growthPages[number]))) return null;
  return (
    <motion.aside className="os-context-rail" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
      <button className="os-rail-collapse" onClick={onCollapse}><ChevronRight size={15}/>收起状态栏</button>
      {(active === "overview" || active === "todo") && <MonthCalendar onSelect={(date) => onNavigate("todo", date === today ? { filter: "today" } : { date })}/>}
      {active === "overview" ? <>
        <section className="os-rail-card os-today-rail">
          <header><span><Target size={16}/>今日任务</span><button onClick={() => onNavigate("todo", { filter: "today" })}>全部 <ArrowRight size={13}/></button></header>
          <div>{todayTasks.length ? todayTasks.slice(0, 3).map((task) => <button key={task.id} onClick={() => onNavigate("todo", { filter: "today", taskId: task.id })}><i className={task.done ? "done" : ""}>{task.done && <Check size={11}/>}</i><span><strong>{task.title}</strong><small>{task.startAt.slice(11,16)} · {task.category}</small></span></button>) : <button className="os-rail-empty-action" onClick={() => onNavigate("todo", { filter: "today", mode: "new" })}><Target size={18}/><span><strong>今天没有安排任务</strong><small>创建今日任务</small></span><ArrowRight size={13}/></button>}</div>
        </section>
        <InspirationCard onNavigate={onNavigate}/>
      </> : active === "todo" ? <>
        <section className="os-rail-card os-rhythm-card">
          <header><span><Sparkles size={16}/>今日节奏</span><time>{today.slice(5).replace("-", ".")}</time></header>
          <div><span>上午<b>{rhythm.morning}</b></span><span>下午<b>{rhythm.afternoon}</b></span><span>晚间<b>{rhythm.evening}</b></span></div>
          <p><i style={{ width: `${stats.todayTodo.progress}%` }}/></p><small>今日完成 {stats.todayTodo.done}/{stats.todayTodo.total}</small>
        </section>
        <section className="os-rail-card os-focus-card"><header><span><Quote size={16}/>优先提醒</span></header><strong>{highPriority[0]?.title ?? "今天保持清晰节奏"}</strong><p>{highPriority.length ? `还有 ${highPriority.length} 个高优先级任务等待处理。` : "没有高优先级阻塞，按计划推进即可。"}</p></section>
      </> : <GrowthRailContent active={active} moods={moods} learning={learning} english={english} fitness={fitness} goals={goals} onNavigate={onNavigate}/>}
    </motion.aside>
  );
}

function GrowthRailContent({ active, moods, learning, english, fitness, goals, onNavigate }: {
  active: PageKey;
  moods: ReturnType<typeof useWorkspaceStore.getState>["moods"];
  learning: ReturnType<typeof useWorkspaceStore.getState>["learning"];
  english: ReturnType<typeof useWorkspaceStore.getState>["english"];
  fitness: ReturnType<typeof useWorkspaceStore.getState>["fitness"];
  goals: ReturnType<typeof useWorkspaceStore.getState>["goals"];
  onNavigate: WorkspaceNavigate;
}) {
  if (active === "mood") {
    const stats = moodGrowthStats(moods);
    const points = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(); date.setDate(date.getDate() - (6 - index));
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return moods.find((entry) => entry.date === iso)?.score ?? 0;
    });
    const keywords = moods.slice(-7).flatMap((entry) => `${entry.story} ${entry.note}`.split(/[，。！？、\s]+/u)).filter((word) => word.length >= 2).slice(0, 6);
    return <><section className="os-rail-card growth-rail-card"><header><span><TrendingUp size={16}/>最近 7 天</span><time>{stats.average || "--"}</time></header><div className="growth-sparkline">{points.map((point, index) => <i key={index} style={{ height: `${Math.max(8, point)}%` }}/>)}</div><small>情绪平均值 · {stats.recent.length} 次记录</small></section><section className="os-rail-card growth-rail-card"><header><span><Sparkles size={16}/>本周关键词</span></header><div className="growth-keywords">{keywords.length ? keywords.map((word, index) => <span key={`${word}-${index}`}>{word}</span>) : <small>记录后会提取情绪线索</small>}</div></section><RailCTA icon={BrainCircuit} title="看看我最近的状态" description="前往 AI Core 梳理情绪轨迹" onClick={() => onNavigate("ai")}/></>;
  }
  if (active === "learning") {
    const stats = learningGrowthStats(learning);
    const latest = learning[0];
    const blocks = latest ? learningBlocksForEntry(latest) : [];
    return <><section className="os-rail-card growth-rail-card"><header><span><BookOpen size={16}/>学习信息</span></header><div className="growth-rail-metrics"><span>本周时间<b>{stats.weeklyMinutes} min</b></span><span>最近分类<b>{stats.latestTopic}</b></span><span>图片<b>{blocks.filter((item) => item.type === "image").length}</b></span><span>附件 / 链接<b>{blocks.filter((item) => item.type === "file" || item.type === "link").length}</b></span></div></section><section className="os-rail-card growth-rail-card"><header><span><Sparkles size={16}/>最近主题</span></header><div className="growth-rail-topics">{learning.slice(0, 4).map((entry) => <span key={entry.id}><i>{entry.category}</i>{entry.title}</span>)}{!learning.length && <small>暂无学习主题</small>}</div></section><RailCTA icon={BrainCircuit} title="让 AI 总结这篇日志" description="前往 AI Core 连接学习上下文" onClick={() => onNavigate("ai")}/></>;
  }
  if (active === "english") {
    const weekly = englishMinutesThisWeek(english);
    const recent = [...english].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
    return <><section className="os-rail-card growth-rail-card"><header><span><Languages size={16}/>Streak Calendar</span><time>{englishStreak(english)} 天</time></header><div className="growth-streak-grid">{Array.from({ length: 28 }, (_, index) => <i key={index} className={english.some((entry) => entry.date === new Date(Date.now() - (27 - index) * 86400000).toISOString().slice(0, 10) && entry.checkedIn) ? "active" : ""}/>)}</div></section><section className="os-rail-card growth-rail-card"><header><span><Target size={16}/>本周目标</span><time>{weekly}/{goals.weeklyEnglishMinutes}</time></header><div className="growth-progress"><i style={{ width: `${Math.min(100, weekly / goals.weeklyEnglishMinutes * 100)}%` }}/></div><small>保持稳定输入，不追求一次完成</small></section><section className="os-rail-card growth-rail-card"><header><span><BarChart3 size={16}/>最近时长</span></header><div className="growth-mini-bars">{recent.map((entry) => <i key={entry.id} style={{ height: `${Math.max(8, Math.min(100, entry.duration / 60 * 100))}%` }} title={`${entry.duration} 分钟`}/>)}</div></section></>;
  }
  const stats = fitnessGrowthStats(fitness);
  const types = Array.from(new Set(stats.weekly.map((entry) => entry.title))).slice(0, 4);
  return <><section className="os-rail-card growth-rail-card"><header><span><BarChart3 size={16}/>本周训练</span><time>{stats.sessions} 次</time></header><div className="growth-week-bars">{[1,2,3,4,5,6,7].map((day) => <span key={day}><i className={stats.weekly.some((entry) => new Date(`${entry.date}T12:00:00`).getDay() === day % 7) ? "active" : ""}/><small>{"一二三四五六日"[day - 1]}</small></span>)}</div></section><section className="os-rail-card growth-rail-card"><header><span><Dumbbell size={16}/>训练类型</span></header><div className="growth-keywords">{types.length ? types.map((type) => <span key={type}>{type}</span>) : <small>记录后显示训练分布</small>}</div></section><section className="os-rail-card growth-rail-card"><header><span><Target size={16}/>本周目标</span><time>{stats.sessions}/{goals.weeklyFitnessSessions}</time></header><div className="growth-progress"><i style={{ width: `${Math.min(100, stats.sessions / goals.weeklyFitnessSessions * 100)}%` }}/></div></section><section className="os-rail-card growth-rail-card"><header><span><Flame size={16}/>下一次训练</span></header><strong className="growth-suggestion">{stats.sessions >= goals.weeklyFitnessSessions ? "安排一次主动恢复" : "保持中等强度，优先完成计划动作"}</strong><small><Timer size={12}/> 建议 30–45 分钟</small></section></>;
}
