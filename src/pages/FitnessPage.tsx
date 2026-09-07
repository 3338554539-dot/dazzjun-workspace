import { useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Dumbbell, Flame, Plus, Save, Target } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CountUp, FadeNotice, Panel, PanelTitle, ProgressRing } from "../components/ui";
import { fitnessThisWeek } from "../services/analytics";
import { monthKey, shortDate, todayISO } from "../services/date";
import { useWorkspaceStore } from "../store/workspaceStore";

export function FitnessPage() {
  const entries = useWorkspaceStore((state) => state.fitness);
  const goals = useWorkspaceStore((state) => state.goals);
  const addFitness = useWorkspaceStore((state) => state.addFitness);
  const [formOpen, setFormOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), title: "力量训练", duration: 45, calories: 320, plan: "热身、力量训练、核心训练、拉伸", completed: true });
  const week = fitnessThisWeek(entries);
  const monthly = useMemo(() => entries.filter((item) => item.date.startsWith(monthKey())).sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const trend = monthly.map((item) => ({ date: Number(item.date.slice(8)), minutes: item.duration, calories: item.calories }));
  const progress = Math.min(100, Math.round(week.sessions / goals.weeklyFitnessSessions * 100));

  const submit = () => {
    if (!form.title.trim()) return;
    addFitness(form);
    setFormOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="fitness-v2">
      <div className="fitness-top page-grid">
        <Panel><PanelTitle icon={Clock3}>本周运动时长</PanelTitle><strong className="big-number"><CountUp value={week.minutes}/><small>min</small></strong><span className="muted-label">共 {week.sessions} 次训练</span></Panel>
        <Panel><PanelTitle icon={Flame}>本周消耗</PanelTitle><strong className="big-number"><CountUp value={week.calories}/><small>kcal</small></strong><span className="muted-label">持续稳定输出</span></Panel>
        <Panel className="weekly-goal compact"><PanelTitle icon={Target}>本周目标</PanelTitle><ProgressRing value={progress} size={150}/><strong>{week.sessions} / {goals.weeklyFitnessSessions} 次训练</strong></Panel>
      </div>

      <div className="fitness-main page-grid">
        <Panel className="fitness-history">
          <PanelTitle icon={Dumbbell} action={<button className="primary-compact" onClick={() => setFormOpen(!formOpen)}><Plus size={15}/>记录训练</button>}>运动记录</PanelTitle>
          {formOpen && <div className="fitness-form">
            <div className="form-grid four">
              <label>运动项目<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label>
              <label>日期<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/></label>
              <label>时长（分钟）<input type="number" value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })}/></label>
              <label>消耗（kcal）<input type="number" value={form.calories} onChange={(event) => setForm({ ...form, calories: Number(event.target.value) })}/></label>
            </div>
            <label>训练计划<textarea value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}/></label>
            <button className="primary-button" onClick={submit}><Save size={16}/>保存运动记录</button>
          </div>}
          {saved && <FadeNotice>运动记录已保存</FadeNotice>}
          <div className="workout-list">
            {entries.length ? entries.slice().sort((a, b) => b.date.localeCompare(a.date)).map((item) => <article key={item.id}>
              <span className="workout-icon"><Dumbbell size={18}/></span>
              <div><strong>{item.title}</strong><small>{shortDate(item.date)} · {item.plan}</small></div>
              <b>{item.duration} min</b><em>{item.calories} kcal</em><Check size={15}/>
            </article>) : <div className="workout-empty"><Dumbbell size={22}/><strong>还没有运动记录</strong><small>完成第一次训练后，趋势与目标会从这里开始生长。</small></div>}
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={CalendarDays} action={<span className="muted-label">本月 {monthly.length} 次</span>}>月度训练趋势</PanelTitle>
          <ResponsiveContainer width="100%" height={270}><AreaChart data={trend}><defs><linearGradient id="fitnessFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent)" stopOpacity={.45}/><stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="date" tick={{ fill: "#777b8d", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{ background: "#111626", border: "1px solid #34364c", borderRadius: 12 }}/><Area type="monotone" dataKey="minutes" stroke="var(--accent)" strokeWidth={2} fill="url(#fitnessFill)" animationDuration={900}/></AreaChart></ResponsiveContainer>
          <div className="trend-summary"><span><b>{monthly.reduce((sum, item) => sum + item.duration, 0)}</b>本月分钟</span><span><b>{monthly.reduce((sum, item) => sum + item.calories, 0)}</b>本月 kcal</span><span><b>{monthly.length}</b>训练次数</span></div>
        </Panel>
      </div>
    </div>
  );
}
