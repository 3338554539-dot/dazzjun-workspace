import { useMemo, useState } from "react";
import { BrainCircuit, CalendarDays, Frown, Heart, Meh, Plus, Save, Smile, Sparkles } from "lucide-react";
import { PageContextHeader, SectionHeader, StatusStrip, TimelineGroup, WorkspaceEmptyState } from "../components/workspace/GrowthUI";
import { useWorkspaceNavigation } from "../components/workspace/WorkspaceNavigation";
import type { MoodEntry, MoodKind } from "../data/types";
import { displayDate, shortDate, todayISO, yesterdayISO } from "../services/date";
import { moodGrowthStats, timelinePeriod } from "../services/growthModules";
import { useWorkspaceStore } from "../store/workspaceStore";

const moodOptions = [
  { id: "低落" as MoodKind, score: 32, icon: Frown }, { id: "疲惫" as MoodKind, score: 45, icon: Meh },
  { id: "平静" as MoodKind, score: 68, icon: Meh }, { id: "开心" as MoodKind, score: 84, icon: Smile },
  { id: "兴奋" as MoodKind, score: 96, icon: Sparkles },
];
const periodLabels = { today: "今天", yesterday: "昨天", week: "本周", older: "更早" } as const;

type MoodDraft = Pick<MoodEntry, "mood" | "story" | "note">;

const draftFromEntry = (entry?: MoodEntry): MoodDraft => ({ mood: entry?.mood ?? "平静", story: entry?.story ?? "", note: entry?.note ?? "" });
const draftChanged = (draft: MoodDraft, entry?: MoodEntry) => {
  const saved = draftFromEntry(entry);
  return draft.mood !== saved.mood || draft.story !== saved.story || draft.note !== saved.note;
};

export function MoodPage() {
  const entries = useWorkspaceStore((state) => state.moods);
  const upsertMood = useWorkspaceStore((state) => state.upsertMood);
  const { navigate, params } = useWorkspaceNavigation();
  const today = todayISO();
  const yesterday = yesterdayISO(today);
  const targetRecord = params.get("recordId");
  const recordDate = entries.find((entry) => entry.id === targetRecord)?.date;
  const initialDate = recordDate ?? params.get("date") ?? today;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [drafts, setDrafts] = useState<Record<string, MoodDraft>>(() => ({ [initialDate]: draftFromEntry(entries.find((entry) => entry.date === initialDate)) }));
  const [saved, setSaved] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const existing = entries.find((entry) => entry.date === selectedDate);
  const draft = drafts[selectedDate] ?? draftFromEntry(existing);
  const stats = useMemo(() => moodGrowthStats(entries, today), [entries, today]);
  const grouped = useMemo(() => {
    const result = { today: [] as MoodEntry[], yesterday: [] as MoodEntry[], week: [] as MoodEntry[], older: [] as MoodEntry[] };
    [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach((entry) => result[timelinePeriod(entry.date, today)].push(entry));
    return result;
  }, [entries, today]);

  const updateDraft = (patch: Partial<MoodDraft>) => {
    setDrafts((current) => ({ ...current, [selectedDate]: { ...(current[selectedDate] ?? draftFromEntry(existing)), ...patch } }));
    setSaved(false);
  };
  const selectDate = (date: string) => {
    if (date === selectedDate) return;
    if (draftChanged(draft, existing)) {
      setDraftNotice(`${displayDate(selectedDate)}的未保存草稿已保留`);
      window.setTimeout(() => setDraftNotice(""), 2400);
    }
    setDrafts((current) => ({ ...current, [selectedDate]: draft, [date]: current[date] ?? draftFromEntry(entries.find((entry) => entry.date === date)) }));
    setSelectedDate(date);
    setSaved(false);
  };
  const save = () => {
    const choice = moodOptions.find((item) => item.id === draft.mood)!;
    upsertMood({ date: selectedDate, mood: draft.mood, score: choice.score, story: draft.story, note: draft.note });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };
  const openAI = () => {
    const prompt = `这是 ${selectedDate} 的心情记录，不一定是今天。请结合记录日期帮我梳理：情绪 ${draft.mood}；发生的事：${draft.story || "未填写"}；想留下的话：${draft.note || "未填写"}。`;
    navigate("ai", { prompt, send: "1" });
  };

  const isToday = selectedDate === today;
  const isYesterday = selectedDate === yesterday;
  const eyebrow = isToday ? "TODAY" : isYesterday ? "YESTERDAY" : shortDate(selectedDate);
  const title = isToday ? "记录此刻" : isYesterday ? "记录昨日心情" : "编辑心情记录";
  const saveLabel = isToday ? "保存日记" : isYesterday ? "保存昨日记录" : "更新心情记录";
  const eventLabel = isToday ? "今天发生了什么？" : isYesterday ? "昨天发生了什么？" : `${shortDate(selectedDate)}发生了什么？`;

  return <div className="growth-page mood-workspace">
    <PageContextHeader eyebrow="EMOTIONAL JOURNAL" title="心情日记" description="记录此刻，也看见情绪随时间留下的轨迹。" action={<button className="growth-secondary-action mood-yesterday-entry" onClick={() => selectDate(yesterday)}><CalendarDays size={15}/>记录昨日心情</button>}/>
    <StatusStrip items={[
      { label: "今日状态", value: stats.today?.mood ?? "待记录", detail: stats.today ? `${stats.today.score} 情绪值` : "留意此刻感受", tone: "violet" },
      { label: "本周记录", value: `${stats.weeklyCount} 次`, detail: "按日记所属日期统计" },
      { label: "7天平均", value: stats.average || "--", detail: "最近状态均值", tone: "green" },
      { label: "连续记录", value: `${stats.streak} 天`, detail: "保持自我观察", tone: "yellow" },
    ]}/>
    <div className="growth-main-grid">
      <aside className="growth-timeline">
        <SectionHeader icon={Heart} eyebrow="TIMELINE" title="情绪时间线"/>
        {entries.length ? (Object.keys(periodLabels) as Array<keyof typeof periodLabels>).map((period) => grouped[period].length ? <TimelineGroup key={period} title={periodLabels[period]}>{grouped[period].map((entry) => <button key={entry.id} className={selectedDate === entry.date ? "active" : ""} onClick={() => selectDate(entry.date)}><i>{entry.mood.slice(0, 1)}</i><span><strong>{entry.story || entry.mood}</strong><small>{shortDate(entry.date)} · {entry.mood}</small></span></button>)}</TimelineGroup> : null) : (
          <WorkspaceEmptyState icon={Heart} title="还没有心情记录" description="从此刻的状态开始。" action="记录今天" onAction={() => selectDate(today)}/>
        )}
      </aside>
      <section className="growth-editor mood-document" data-selected-date={selectedDate}>
        <SectionHeader icon={existing ? Heart : Plus} eyebrow={eyebrow} title={title} action={<div className="mood-editor-actions">{saved && <span className="growth-saved">已保存</span>}<div className="mood-date-switch" role="group" aria-label="选择心情记录日期"><button className={isToday ? "active" : ""} aria-pressed={isToday} onClick={() => selectDate(today)}>今天</button><button className={isYesterday ? "active" : ""} aria-pressed={isYesterday} onClick={() => selectDate(yesterday)}>昨天</button></div></div>}/>
        <div className="mood-record-date"><CalendarDays size={14}/><span>{displayDate(selectedDate)}</span>{existing && <small>已有记录，保存后更新原内容</small>}</div>
        {draftNotice && <div className="mood-draft-notice">{draftNotice}</div>}
        <div className="mood-choice-row">{moodOptions.map((mood) => <button key={mood.id} className={draft.mood === mood.id ? "selected" : ""} onClick={() => updateDraft({ mood: mood.id })}><mood.icon size={21}/><span>{mood.id}</span></button>)}</div>
        <label className="growth-writing-field"><span>{eventLabel}</span><textarea value={draft.story} onChange={(event) => updateDraft({ story: event.target.value })} placeholder="记录事件、变化，或只是一个瞬间…"/></label>
        <label className="growth-writing-field compact"><span>有什么想留下的吗？</span><textarea value={draft.note} onChange={(event) => updateDraft({ note: event.target.value })} placeholder="写下感受、想法或一句给自己的话…"/></label>
        <footer className="growth-editor-footer"><button className="growth-secondary-action" onClick={openAI}><BrainCircuit size={15}/>与 AI 一起梳理</button><button className="growth-primary-action" onClick={save}><Save size={15}/>{saveLabel}</button></footer>
      </section>
    </div>
  </div>;
}
