import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Frown, Heart, Meh, Plus, Save, Smile, Sparkles } from "lucide-react";
import { PageContextHeader, SectionHeader, StatusStrip, TimelineGroup, WorkspaceEmptyState } from "../components/workspace/GrowthUI";
import { useWorkspaceNavigation } from "../components/workspace/WorkspaceNavigation";
import type { MoodEntry, MoodKind } from "../data/types";
import { shortDate, todayISO } from "../services/date";
import { moodGrowthStats, timelinePeriod } from "../services/growthModules";
import { useWorkspaceStore } from "../store/workspaceStore";

const moods = [
  { id: "低落" as MoodKind, score: 32, icon: Frown }, { id: "疲惫" as MoodKind, score: 45, icon: Meh },
  { id: "平静" as MoodKind, score: 68, icon: Meh }, { id: "开心" as MoodKind, score: 84, icon: Smile },
  { id: "兴奋" as MoodKind, score: 96, icon: Sparkles },
];
const periodLabels = { today: "今天", yesterday: "昨天", week: "本周", older: "更早" } as const;

export function MoodPage() {
  const entries = useWorkspaceStore((state) => state.moods);
  const upsertMood = useWorkspaceStore((state) => state.upsertMood);
  const { navigate, params } = useWorkspaceNavigation();
  const today = todayISO();
  const targetDate = params.get("date") ?? today;
  const targetRecord = params.get("recordId");
  const initialId = params.get("mode") === "new" ? "new" : targetRecord ?? entries.find((entry) => entry.date === targetDate)?.id ?? "new";
  const [selectedId, setSelectedId] = useState(initialId);
  const existing = selectedId === "new" ? undefined : entries.find((entry) => entry.id === selectedId);
  const [selected, setSelected] = useState<MoodKind>(existing?.mood ?? "平静");
  const [story, setStory] = useState(existing?.story ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [saved, setSaved] = useState(false);
  const stats = useMemo(() => moodGrowthStats(entries, today), [entries, today]);
  const grouped = useMemo(() => {
    const result = { today: [] as MoodEntry[], yesterday: [] as MoodEntry[], week: [] as MoodEntry[], older: [] as MoodEntry[] };
    [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach((entry) => result[timelinePeriod(entry.date, today)].push(entry));
    return result;
  }, [entries, today]);

  useEffect(() => {
    if (!existing) { setSelected("平静"); setStory(""); setNote(""); return; }
    setSelected(existing.mood); setStory(existing.story); setNote(existing.note);
  }, [existing?.id]);

  const startNew = () => { setSelectedId("new"); setSelected("平静"); setStory(""); setNote(""); };
  const save = () => {
    const choice = moods.find((item) => item.id === selected)!;
    upsertMood({ date: existing?.date ?? targetDate, mood: selected, score: choice.score, story, note });
    setSaved(true); window.setTimeout(() => setSaved(false), 1600);
  };

  return <div className="growth-page mood-workspace">
    <PageContextHeader eyebrow="EMOTIONAL JOURNAL" title="心情日记" description="记录此刻，也看见情绪随时间留下的轨迹。" action={<button className="growth-primary-action" onClick={startNew}><Plus size={15}/>记录心情</button>}/>
    <StatusStrip items={[
      { label: "今日状态", value: stats.today?.mood ?? "未记录", detail: stats.today ? `${stats.today.score} 情绪值` : "留意此刻感受", tone: "violet" },
      { label: "本周记录", value: `${stats.weeklyCount} 次`, detail: "情绪记录频率" },
      { label: "7天平均", value: stats.average || "--", detail: "最近状态均值", tone: "green" },
      { label: "连续记录", value: `${stats.streak} 天`, detail: "保持自我观察", tone: "yellow" },
    ]}/>
    <div className="growth-main-grid">
      <aside className="growth-timeline">
        <SectionHeader icon={Heart} eyebrow="TIMELINE" title="情绪时间线"/>
        {entries.length ? (Object.keys(periodLabels) as Array<keyof typeof periodLabels>).map((period) => grouped[period].length ? <TimelineGroup key={period} title={periodLabels[period]}>{grouped[period].map((entry) => <button key={entry.id} className={selectedId === entry.id ? "active" : ""} onClick={() => setSelectedId(entry.id)}><i>{entry.mood.slice(0, 1)}</i><span><strong>{entry.story || entry.mood}</strong><small>{shortDate(entry.date)} · {entry.mood}</small></span></button>)}</TimelineGroup> : null) : (
          <WorkspaceEmptyState icon={Heart} title="还没有心情记录" description="从此刻的状态开始。" action="记录心情" onAction={startNew}/>
        )}
      </aside>
      <section className="growth-editor mood-document">
        <SectionHeader icon={existing ? Heart : Plus} eyebrow={existing ? shortDate(existing.date) : "TODAY"} title={existing ? "日记详情" : "记录此刻"} action={saved ? <span className="growth-saved">已保存</span> : undefined}/>
        <div className="mood-choice-row">{moods.map((mood) => <button key={mood.id} className={selected === mood.id ? "selected" : ""} onClick={() => setSelected(mood.id)}><mood.icon size={21}/><span>{mood.id}</span></button>)}</div>
        <label className="growth-writing-field"><span>今天发生了什么？</span><textarea value={story} onChange={(event) => setStory(event.target.value)} placeholder="记录事件、变化，或只是一个瞬间…"/></label>
        <label className="growth-writing-field compact"><span>有什么想留下的吗？</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="写下感受、想法或一句给自己的话…"/></label>
        <footer className="growth-editor-footer"><button className="growth-secondary-action" onClick={() => navigate("ai")}><BrainCircuit size={15}/>与 AI 一起梳理</button><button className="growth-primary-action" onClick={save}><Save size={15}/>保存日记</button></footer>
      </section>
    </div>
  </div>;
}
