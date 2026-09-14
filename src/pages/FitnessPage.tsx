import { AnimatePresence, motion } from "framer-motion";
import { Check, Dumbbell, Flame, Plus, Save, Timer, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageContextHeader, SectionHeader, StatusStrip, TimelineGroup, WorkspaceEmptyState } from "../components/workspace/GrowthUI";
import type { FitnessEntry } from "../data/types";
import { shortDate, todayISO } from "../services/date";
import { fitnessGrowthStats, timelinePeriod } from "../services/growthModules";
import { useWorkspaceStore } from "../store/workspaceStore";
import { useWorkspaceNavigation } from "../components/workspace/WorkspaceNavigation";
import { isBetween, weekMeta } from "../services/date";

const periodLabels = { today: "今天", yesterday: "昨天", week: "本周", older: "更早" } as const;
const initialForm = () => ({ date: todayISO(), title: "力量训练", duration: 45, calories: 320, plan: "深蹲 4 × 12\n卧推 4 × 8\n拉伸 10 min", completed: true });

export function FitnessPage() {
  const { params } = useWorkspaceNavigation();
  const entries = useWorkspaceStore((state) => state.fitness);
  const goals = useWorkspaceStore((state) => state.goals);
  const addFitness = useWorkspaceStore((state) => state.addFitness);
  const week = weekMeta();
  const weeklyFirst = entries.find((entry) => isBetween(entry.date, week.start, week.end));
  const [selectedId, setSelectedId] = useState(params.get("recordId") ?? (params.get("filter") === "week" ? weeklyFirst?.id : entries[0]?.id) ?? "");
  const [formOpen, setFormOpen] = useState(params.get("mode") === "new");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(initialForm);
  const stats = useMemo(() => fitnessGrowthStats(entries), [entries]);
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const grouped = useMemo(() => {
    const result = { today: [] as FitnessEntry[], yesterday: [] as FitnessEntry[], week: [] as FitnessEntry[], older: [] as FitnessEntry[] };
    [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach((entry) => result[timelinePeriod(entry.date)].push(entry));
    return result;
  }, [entries]);
  const openNew = () => { setForm(initialForm()); setFormOpen(true); };
  const submit = () => {
    if (!form.title.trim()) return;
    addFitness({ ...form, title: form.title.trim(), plan: form.plan.trim() });
    setFormOpen(false); setSaved(true); window.setTimeout(() => setSaved(false), 1500);
  };

  return <div className="growth-page fitness-workspace">
    <PageContextHeader eyebrow="FITNESS RHYTHM" title="健身锻炼" description="记录训练负荷，让身体状态成为可持续的节奏。" action={<button className="growth-primary-action" onClick={openNew}><Plus size={15}/>记录训练</button>}/>
    <StatusStrip items={[
      { label: "本周训练", value: `${stats.sessions} 次`, detail: `${Math.min(100, Math.round(stats.sessions / goals.weeklyFitnessSessions * 100))}% 周目标`, tone: "violet" },
      { label: "本周时长", value: `${stats.minutes} min`, detail: "有效训练时间" },
      { label: "本周消耗", value: `${stats.calories} kcal`, detail: "训练消耗记录", tone: "green" },
      { label: "连续运动", value: `${stats.streak} 天`, detail: "稳定比强度更重要", tone: "yellow" },
    ]}/>
    <div className="growth-main-grid">
      <aside className="growth-timeline"><SectionHeader icon={Dumbbell} eyebrow="TRAINING HISTORY" title="训练历史"/>
        {entries.length ? (Object.keys(periodLabels) as Array<keyof typeof periodLabels>).map((period) => grouped[period].length ? <TimelineGroup key={period} title={periodLabels[period]}>{grouped[period].map((entry) => <button key={entry.id} className={selected?.id === entry.id ? "active" : ""} onClick={() => setSelectedId(entry.id)}><i><Dumbbell size={14}/></i><span><strong>{entry.title}</strong><small>{shortDate(entry.date)} · {entry.duration} min</small></span></button>)}</TimelineGroup> : null) : (
          <WorkspaceEmptyState icon={Dumbbell} title="还没有训练记录" description="第一次训练会从这里开始累积。" action="记录训练" onAction={openNew}/>
        )}
      </aside>
      <section className="growth-editor fitness-document">
        <SectionHeader icon={Dumbbell} eyebrow="TRAINING DETAIL" title={selected ? selected.title : "当前训练"} action={saved ? <span className="growth-saved">已保存</span> : undefined}/>
        {selected ? <>
          <div className="fitness-detail-meta"><span><Timer size={15}/><strong>{selected.duration}</strong>分钟</span><span><Flame size={15}/><strong>{selected.calories}</strong>kcal</span><span><Check size={15}/>{selected.completed ? "已完成" : "计划中"}</span></div>
          <div className="fitness-exercise-list">{selected.plan.split(/\n|、/u).filter(Boolean).map((line, index) => <div key={`${line}-${index}`}><i>{String(index + 1).padStart(2, "0")}</i><span>{line.trim()}</span></div>)}</div>
          <footer className="growth-editor-footer"><span>{selected.date} · 训练记录</span><button className="growth-primary-action" onClick={openNew}><Plus size={15}/>新增训练</button></footer>
        </> : (
          <WorkspaceEmptyState icon={Dumbbell} title="准备开始训练" description="记录类型、动作和训练负荷。" action="创建训练" onAction={openNew}/>
        )}
      </section>
    </div>
    <AnimatePresence>{formOpen && <motion.div className="growth-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFormOpen(false)}><motion.aside className="growth-drawer" initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: 40 }} onClick={(event) => event.stopPropagation()}><header><div><small>NEW TRAINING</small><h3>记录本次训练</h3></div><button onClick={() => setFormOpen(false)} aria-label="关闭"><X size={18}/></button></header><div className="growth-drawer-form"><label>训练类型<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label><div><label>日期<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/></label><label>时长（分钟）<input type="number" min="0" value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })}/></label></div><label>动作 / 组数 / 重量<textarea value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })} placeholder="一行一个动作，例如：深蹲 4 × 12"/></label><label>消耗热量<input type="number" min="0" value={form.calories} onChange={(event) => setForm({ ...form, calories: Number(event.target.value) })}/></label><label className="growth-check"><input type="checkbox" checked={form.completed} onChange={(event) => setForm({ ...form, completed: event.target.checked })}/><span>标记为已完成训练</span></label></div><footer><button onClick={() => setFormOpen(false)}>取消</button><button className="primary" onClick={submit}><Save size={15}/>保存训练</button></footer></motion.aside></motion.div>}</AnimatePresence>
  </div>;
}
