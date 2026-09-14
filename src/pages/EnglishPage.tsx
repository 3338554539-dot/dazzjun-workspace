import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Clock3, Headphones, Languages, Mic2, Plus, Save } from "lucide-react";
import { PageContextHeader, SectionHeader, StatusStrip, TimelineGroup, WorkspaceEmptyState } from "../components/workspace/GrowthUI";
import type { EnglishCategory, EnglishEntry } from "../data/types";
import { englishMinutesThisWeek, englishStreak } from "../services/analytics";
import { shortDate, todayISO } from "../services/date";
import { decodeEnglishPracticeNote, encodeEnglishPracticeNote, timelinePeriod } from "../services/growthModules";
import { useWorkspaceStore } from "../store/workspaceStore";
import { useWorkspaceNavigation } from "../components/workspace/WorkspaceNavigation";

const training = [
  { id: "单词" as EnglishCategory, icon: Languages, label: "单词" }, { id: "听力" as EnglishCategory, icon: Headphones, label: "听力" },
  { id: "阅读" as EnglishCategory, icon: BookOpen, label: "阅读" }, { id: "口语" as EnglishCategory, icon: Mic2, label: "口语" },
];
const periodLabels = { today: "今天", yesterday: "昨天", week: "本周", older: "更早" } as const;

export function EnglishPage() {
  const { params } = useWorkspaceNavigation();
  const entries = useWorkspaceStore((state) => state.english);
  const goals = useWorkspaceStore((state) => state.goals);
  const upsertEnglish = useWorkspaceStore((state) => state.upsertEnglish);
  const today = todayISO();
  const requestedId = params.get("mode") === "new" ? "" : params.get("recordId") ?? "";
  const [selectedId, setSelectedId] = useState(requestedId);
  const existing = entries.find((entry) => entry.id === selectedId) ?? entries.find((entry) => entry.date === today);
  const initialNote = decodeEnglishPracticeNote(existing?.note ?? "");
  const [duration, setDuration] = useState(existing?.duration ?? 30);
  const [words, setWords] = useState(existing?.words ?? 0);
  const [exercises, setExercises] = useState(existing?.exercises ?? 1);
  const [categories, setCategories] = useState<EnglishCategory[]>(existing?.categories ?? ["单词"]);
  const [practice, setPractice] = useState(initialNote);
  const [saved, setSaved] = useState(false);
  const weeklyMinutes = englishMinutesThisWeek(entries);
  const weeklyEntries = entries.filter((entry) => timelinePeriod(entry.date, today) !== "older");
  const grouped = useMemo(() => {
    const result = { today: [] as EnglishEntry[], yesterday: [] as EnglishEntry[], week: [] as EnglishEntry[], older: [] as EnglishEntry[] };
    [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach((entry) => result[timelinePeriod(entry.date, today)].push(entry));
    return result;
  }, [entries, today]);
  const save = () => {
    upsertEnglish({ date: existing?.date ?? today, checkedIn: true, duration, words, exercises, categories, note: encodeEnglishPracticeNote(practice) });
    setSaved(true); window.setTimeout(() => setSaved(false), 1600);
  };
  const toggleCategory = (item: EnglishCategory) => setCategories((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);

  const newMode = params.get("mode") === "new";
  useEffect(() => { if (newMode) window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("#english-learned")?.focus()); }, [newMode]);
  const openEntry = (entry: EnglishEntry) => {
    const note = decodeEnglishPracticeNote(entry.note);
    setSelectedId(entry.id); setDuration(entry.duration); setWords(entry.words); setExercises(entry.exercises); setCategories(entry.categories); setPractice(note);
  };

  return <div className="growth-page english-workspace">
    <PageContextHeader eyebrow="ENGLISH PRACTICE" title="英语学习" description="把语言练习变成稳定、轻盈的日常节奏。" action={<span className="growth-header-date">{shortDate(today)}</span>}/>
    <StatusStrip items={[
      { label: "连续打卡", value: `${englishStreak(entries)} 天`, detail: "保持语言触感", tone: "violet" },
      { label: "本周时间", value: `${weeklyMinutes} min`, detail: "累计学习时长" },
      { label: "本周目标", value: `${weeklyMinutes} / ${goals.weeklyEnglishMinutes}`, detail: `${Math.min(100, Math.round(weeklyMinutes / goals.weeklyEnglishMinutes * 100))}% 已完成`, tone: "green" },
      { label: "本周练习", value: `${weeklyEntries.length} 次`, detail: "听说读写累计", tone: "yellow" },
    ]}/>
    <div className="growth-main-grid">
      <aside className="growth-timeline"><SectionHeader icon={Clock3} eyebrow="RECENT PRACTICE" title="最近练习"/>
        {entries.length ? (Object.keys(periodLabels) as Array<keyof typeof periodLabels>).map((period) => grouped[period].length ? <TimelineGroup key={period} title={periodLabels[period]}>{grouped[period].map((entry) => <button key={entry.id} className={existing?.id === entry.id ? "active" : ""} onClick={() => openEntry(entry)}><i>{entry.duration}</i><span><strong>{entry.categories.join(" · ") || "英语练习"}</strong><small>{shortDate(entry.date)} · {entry.duration} min</small></span></button>)}</TimelineGroup> : null) : <WorkspaceEmptyState icon={Languages} title="还没有英语练习" description="从今天的一小段输入开始。" action="开始今日练习" onAction={() => document.querySelector<HTMLTextAreaElement>("#english-learned")?.focus()}/>}
      </aside>
      <section className="growth-editor english-document">
        <SectionHeader icon={Languages} eyebrow={existing?.date === today || !existing ? "TODAY'S ENGLISH" : shortDate(existing.date)} title={existing?.date === today || !existing ? "今日英语" : "练习记录"} action={saved ? <span className="growth-saved">已保存</span> : undefined}/>
        <div className="english-compact-metrics"><label>学习时间<span><input type="number" min="0" value={duration} onChange={(event) => setDuration(Number(event.target.value))}/><small>min</small></span></label><label>新单词数<span><input type="number" min="0" value={words} onChange={(event) => setWords(Number(event.target.value))}/><small>words</small></span></label><label>练习组数<span><input type="number" min="0" value={exercises} onChange={(event) => setExercises(Number(event.target.value))}/><small>sets</small></span></label></div>
        <div className="english-category-row">{training.map((item) => <button key={item.id} className={categories.includes(item.id) ? "active" : ""} onClick={() => toggleCategory(item.id)}><item.icon size={16}/>{item.label}{categories.includes(item.id) && <Check size={13}/>}</button>)}</div>
        <label className="growth-writing-field compact"><span>今天学了什么？</span><textarea id="english-learned" value={practice.learned} onChange={(event) => setPractice({ ...practice, learned: event.target.value })} placeholder="主题、材料或练习内容…"/></label>
        <div className="english-pair-fields"><label><span>新单词</span><input value={practice.words} onChange={(event) => setPractice({ ...practice, words: event.target.value })} placeholder="focus, momentum, clarity"/></label><label><span>好表达</span><input value={practice.expressions} onChange={(event) => setPractice({ ...practice, expressions: event.target.value })} placeholder="A useful expression…"/></label></div>
        <label className="english-line-field"><span>材料 / 链接</span><input value={practice.material} onChange={(event) => setPractice({ ...practice, material: event.target.value })} placeholder="https:// 或材料名称"/></label>
        <label className="english-line-field"><span>一句总结</span><input value={practice.summary} onChange={(event) => setPractice({ ...practice, summary: event.target.value })} placeholder="用一句话结束今天的练习"/></label>
        <footer className="growth-editor-footer"><span>完成后计入连续打卡</span><button className="growth-primary-action" onClick={save}><Save size={15}/>{existing?.checkedIn ? "更新今日记录" : "完成今日打卡"}</button></footer>
      </section>
    </div>
  </div>;
}
