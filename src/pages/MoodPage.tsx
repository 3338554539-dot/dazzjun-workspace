import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, Frown, Heart, Meh, Save, Smile, Sparkles } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FadeNotice, Panel, PanelTitle } from "../components/ui";
import type { MoodKind } from "../data/types";
import { displayDate, monthKey, todayISO } from "../services/date";
import { useWorkspaceStore } from "../store/workspaceStore";

const moods = [
  { id: "低落" as MoodKind, score: 32, icon: Frown },
  { id: "疲惫" as MoodKind, score: 45, icon: Meh },
  { id: "平静" as MoodKind, score: 68, icon: Meh },
  { id: "开心" as MoodKind, score: 84, icon: Smile },
  { id: "兴奋" as MoodKind, score: 96, icon: Sparkles },
];

export function MoodPage() {
  const entries = useWorkspaceStore((state) => state.moods);
  const upsertMood = useWorkspaceStore((state) => state.upsertMood);
  const today = todayISO();
  const existing = entries.find((entry) => entry.date === today);
  const [selected, setSelected] = useState<MoodKind>(existing?.mood ?? "平静");
  const [story, setStory] = useState(existing?.story ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (existing) { setSelected(existing.mood); setStory(existing.story); setNote(existing.note); } }, [existing?.id]);
  const monthly = useMemo(() => entries.filter((entry) => entry.date.startsWith(monthKey())).sort((a,b) => a.date.localeCompare(b.date)), [entries]);
  const recent = [...entries].sort((a,b) => b.date.localeCompare(a.date)).slice(0,4);
  const save = () => {
    const choice = moods.find((item) => item.id === selected)!;
    upsertMood({ date: today, mood: selected, score: choice.score, story, note });
    setSaved(true); setTimeout(() => setSaved(false), 1600);
  };
  return (
    <div className="mood-layout page-grid">
      <div className="mood-date-column"><Panel><small>今天是</small><strong className="large-date">{displayDate(today)}</strong><span>{new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(new Date())}</span></Panel><Panel><PanelTitle icon={CalendarDays}>{today.slice(0,7).replace("-","年")}月</PanelTitle><CalendarGrid activeDates={new Set(monthly.map((item) => item.date))}/></Panel></div>
      <Panel className="mood-editor"><PanelTitle icon={Heart} action={saved ? <FadeNotice>已保存到情绪数据库</FadeNotice> : undefined}>今天的心情是</PanelTitle><div className="mood-options">{moods.map((mood) => <button key={mood.id} className={selected === mood.id ? "selected" : ""} onClick={() => setSelected(mood.id)}><mood.icon size={28}/><span>{mood.id}</span></button>)}</div><label>今天发生了什么？<textarea value={story} onChange={(event) => setStory(event.target.value)} placeholder="记录今天发生的事情…"/></label><label>今天想记录什么？<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="你的感受、想法、收获或感激的事情…"/></label><button className="primary-button" onClick={save}><Save size={17}/>保存日记</button></Panel>
      <div className="mood-insights"><Panel><PanelTitle icon={Sparkles} action={<small>本月 {monthly.length} 次记录</small>}>月度情绪趋势</PanelTitle><ResponsiveContainer width="100%" height={180}><AreaChart data={monthly.map((item) => ({ day: Number(item.date.slice(8)), score: item.score, mood: item.mood }))}><defs><linearGradient id="moodFillV2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9e79ff" stopOpacity={.5}/><stop offset="95%" stopColor="#9e79ff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="day" tick={{ fill: "#73758b", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis hide domain={[0,100]}/><Tooltip contentStyle={{ background: "#111626", border: "1px solid #34364c", borderRadius: 12 }}/><Area type="monotone" dataKey="score" stroke="#aa86ff" strokeWidth={2} fill="url(#moodFillV2)" animationDuration={900}/></AreaChart></ResponsiveContainer></Panel><Panel><PanelTitle icon={BookOpen}>情绪历史</PanelTitle><div className="recent-list">{recent.map((entry) => <span key={entry.id}><Smile size={22}/><i><b>{entry.story || "今天没有写事件摘要"}</b>{entry.date} · {entry.mood} · {entry.score} 分</i></span>)}</div></Panel></div>
    </div>
  );
}

function CalendarGrid({ activeDates }: { activeDates: Set<string> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + count }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  return <div className="calendar-grid"><div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>{cells.map((day,index) => day ? <span key={index} className={`${day === now.getDate() ? "today" : ""} ${activeDates.has(`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`) ? "has-entry" : ""}`}>{day}</span> : <span key={index}/>)}</div>;
}
