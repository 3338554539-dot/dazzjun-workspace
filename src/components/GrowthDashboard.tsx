import type { CSSProperties } from "react";
import { Activity, BookOpen, Bookmark, BrainCircuit, Clock3, Dumbbell, Flame, Languages, MoonStar, PenLine, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { HabitId } from "../data/types";
import { isHabitComplete } from "../services/analytics";
import { daysAgoISO, todayISO } from "../services/date";
import { useWorkspaceStore } from "../store/workspaceStore";
import { CountUp, Panel, PanelTitle } from "./ui";

type GrowthValues = { task: number; learning: number; fitness: number; mood: number; overall: number };
type YearValues = { year: string; learningSessions: number; learningMinutes: number; notes: number; inspirations: number; fitnessSessions: number; bestStreak: number };

const ringItems = [
  { key: "task", label: "行动", color: "#b98cff" },
  { key: "learning", label: "成长", color: "#7c91ff" },
  { key: "fitness", label: "身体", color: "#4bd4b0" },
  { key: "mood", label: "情绪", color: "#ee86b6" },
] as const;

export function GrowthRings({ values }: { values: GrowthValues }) {
  return <div className="growth-ring-layout"><div className="growth-rings" aria-label={`个人成长完成度 ${values.overall}%`}>{ringItems.map((ring, index) => <motion.i initial={{ opacity: 0, rotate: -30 }} animate={{ opacity: 1, rotate: 0 }} transition={{ delay: index * .08, duration: .65 }} key={ring.key} style={{ "--ring-progress": `${values[ring.key] * 3.6}deg`, "--ring-color": ring.color, inset: `${index * 15}px` } as CSSProperties}/>) }<div><strong><CountUp value={values.overall}/><small>%</small></strong><span>今日成长</span></div></div><div className="growth-ring-legend">{ringItems.map((ring) => <span key={ring.key}><i style={{ background: ring.color }}/><b>{ring.label}</b><strong>{values[ring.key]}%</strong></span>)}</div></div>;
}

const habits: Array<{ id: HabitId; label: string; icon: typeof BookOpen }> = [
  { id: "reading", label: "阅读", icon: BookOpen },
  { id: "english", label: "英语", icon: Languages },
  { id: "fitness", label: "健身", icon: Dumbbell },
  { id: "writing", label: "写作", icon: PenLine },
  { id: "sleep", label: "早睡", icon: MoonStar },
];

export function HabitTracker({ streaks }: { streaks: Record<HabitId, number> }) {
  const todos = useWorkspaceStore((state) => state.todos);
  const learning = useWorkspaceStore((state) => state.learning);
  const english = useWorkspaceStore((state) => state.english);
  const fitness = useWorkspaceStore((state) => state.fitness);
  const inspirationNotes = useWorkspaceStore((state) => state.inspirationNotes);
  const habitCompletions = useWorkspaceStore((state) => state.habitCompletions);
  const setHabitCompletion = useWorkspaceStore((state) => state.setHabitCompletion);
  const dates = Array.from({ length: 28 }, (_, index) => daysAgoISO(27 - index));
  const sources = { todos, learning, english, fitness, inspirationNotes, habitCompletions };

  return <Panel className="habit-tracker-panel"><PanelTitle icon={Activity} action={<span className="habit-live"><Flame size={13}/> English Day {streaks.english}</span>}>Habit Tracker</PanelTitle><div className="habit-calendar" onTouchStart={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}><div className="habit-calendar-head"><span>DAILY RHYTHM</span>{dates.map((date, index) => <time key={date}>{index % 7 === 6 || index === 27 ? new Date(`${date}T12:00:00`).getDate() : ""}</time>)}</div>{habits.map((habit) => { const Icon = habit.icon; return <div className="habit-row" key={habit.id}><span><Icon size={14}/>{habit.label}<b>{streaks[habit.id]}d</b></span>{dates.map((date) => { const complete = isHabitComplete(habit.id, date, sources); return <button key={date} className={complete ? "complete" : ""} aria-label={`${date} ${habit.label}${complete ? "已完成" : "未完成"}`} title={`${date} · ${habit.label}`} onClick={() => setHabitCompletion(habit.id, date, !complete)}/>; })}</div>; })}</div><footer><span><i/>未完成</span><span><i className="complete"/>已完成</span><small>点击任意节点补记习惯 · 模块完成会自动点亮</small></footer></Panel>;
}

export function YearOverview({ data }: { data: YearValues }) {
  const cards = [
    { label: "学习", value: data.learningSessions, suffix: "次", meta: `${data.learningMinutes} 分钟`, icon: BookOpen },
    { label: "创作", value: data.notes, suffix: "篇", meta: `${data.inspirations} 条收藏`, icon: PenLine },
    { label: "健康", value: data.fitnessSessions, suffix: "次", meta: "年度运动记录", icon: Dumbbell },
    { label: "习惯", value: data.bestStreak, suffix: "天", meta: "当前最长连续", icon: Flame },
  ];
  return <Panel className="year-overview"><PanelTitle icon={Sparkles} action={<span className="ai-ready"><BrainCircuit size={13}/>AI REPORT READY</span>}>{data.year} Year Overview</PanelTitle><div className="year-metrics">{cards.map((item) => <motion.article whileHover={{ y: -3 }} key={item.label}><item.icon size={17}/><small>{item.label}</small><strong><CountUp value={item.value}/><i>{item.suffix}</i></strong><span>{item.meta}</span></motion.article>)}</div><div className="year-timeline"><span style={{ width: `${Math.max(5, Math.round((Number(todayISO().slice(5,7)) - 1) / 12 * 100))}%` }}/><i><Clock3 size={13}/> {data.year} · 成长持续记录中</i><b><Bookmark size={13}/>所有数据已沉淀在本地</b></div></Panel>;
}
