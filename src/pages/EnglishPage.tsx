import { useMemo, useState } from "react";
import { BookOpen, CalendarDays, Check, CheckCircle2, Clock3, Headphones, Languages, Mic2, Save, Trophy, Zap } from "lucide-react";
import { CountUp, FadeNotice, Panel, PanelTitle } from "../components/ui";
import type { EnglishCategory } from "../data/types";
import { englishMinutesThisWeek, englishStreak } from "../services/analytics";
import { daysAgoISO, todayISO } from "../services/date";
import { useWorkspaceStore } from "../store/workspaceStore";

const training = [
  { id: "单词" as EnglishCategory, icon: Languages, label: "单词学习" },
  { id: "听力" as EnglishCategory, icon: Headphones, label: "听力训练" },
  { id: "阅读" as EnglishCategory, icon: BookOpen, label: "阅读训练" },
  { id: "口语" as EnglishCategory, icon: Mic2, label: "口语训练" },
];

export function EnglishPage() {
  const entries = useWorkspaceStore((state) => state.english);
  const goals = useWorkspaceStore((state) => state.goals);
  const upsertEnglish = useWorkspaceStore((state) => state.upsertEnglish);
  const today = todayISO();
  const existing = entries.find((entry) => entry.date === today);
  const [duration, setDuration] = useState(existing?.duration ?? 30);
  const [words, setWords] = useState(existing?.words ?? 50);
  const [exercises, setExercises] = useState(existing?.exercises ?? 3);
  const [categories, setCategories] = useState<EnglishCategory[]>(existing?.categories ?? ["单词"]);
  const [note, setNote] = useState(existing?.note ?? "");
  const [saved, setSaved] = useState(false);
  const streak = englishStreak(entries);
  const weeklyMinutes = englishMinutesThisWeek(entries);
  const contributionDays = useMemo(() => Array.from({ length: 84 }, (_, index) => daysAgoISO(83-index)).map((date) => ({ date, entry: entries.find((item) => item.date === date) })), [entries]);
  const save = () => {
    upsertEnglish({ date: today, checkedIn: true, duration, words, exercises, categories, note });
    setSaved(true); setTimeout(() => setSaved(false), 1600);
  };
  const toggleCategory = (item: EnglishCategory) => setCategories(categories.includes(item) ? categories.filter((value) => value !== item) : [...categories, item]);
  return (
    <div className="english-page">
      <div className="english-top page-grid">
        <Panel className="checkin-card"><PanelTitle icon={CheckCircle2}>今日打卡</PanelTitle><div className={`streak-medal ${existing?.checkedIn ? "complete" : ""}`}><Trophy size={34}/><strong><CountUp value={streak}/></strong><span>连续学习天数</span></div><button className="primary-button wide" onClick={save}>{existing?.checkedIn ? <><Check size={17}/>更新今日记录</> : <><Zap size={17}/>完成今日打卡</>}</button></Panel>
        <Panel className="english-overview"><PanelTitle icon={CalendarDays} action={saved ? <FadeNotice>英语数据已保存</FadeNotice> : undefined}>今日学习数据</PanelTitle><div className="editable-metrics"><label><span>学习时间</span><input type="number" min="0" value={duration} onChange={(e) => setDuration(Number(e.target.value))}/><small>min</small></label><label><span>单词数量</span><input type="number" min="0" value={words} onChange={(e) => setWords(Number(e.target.value))}/><small>words</small></label><label><span>完成练习</span><input type="number" min="0" value={exercises} onChange={(e) => setExercises(Number(e.target.value))}/><small>sets</small></label></div><div className="linear-progress"><span style={{ width: `${Math.min(100, weeklyMinutes / goals.weeklyEnglishMinutes * 100)}%` }}/></div><div className="goal-copy"><small>本周目标：{goals.weeklyEnglishMinutes} 分钟</small><b>{weeklyMinutes} min</b></div><label className="english-note">今日笔记<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="记录一个新单词或一句表达"/></label></Panel>
        <Panel className="training-picker"><PanelTitle icon={Languages}>训练分类</PanelTitle><div className="training-buttons">{training.map((item) => <button className={categories.includes(item.id) ? "active" : ""} key={item.id} onClick={() => toggleCategory(item.id)}><item.icon size={19}/><span>{item.label}</span>{categories.includes(item.id) && <Check size={14}/>}</button>)}</div></Panel>
      </div>
      <Panel className="contribution-panel"><PanelTitle icon={CalendarDays} action={<span className="muted-label">过去 12 周 · {entries.filter((item) => item.checkedIn).length} 次学习</span>}>英语学习日历</PanelTitle><div className="contribution-wrap"><div className="contribution-grid">{contributionDays.map(({date,entry}) => { const level = entry ? Math.min(4, Math.max(1, Math.ceil(entry.duration / 15))) : 0; return <button key={date} className={`contribution level-${level}`} title={`${date} · ${entry ? `${entry.duration} 分钟` : "未学习"}`} aria-label={`${date}${entry ? `学习${entry.duration}分钟` : "未学习"}`}/>; })}</div><div className="contribution-legend"><span>少</span>{[0,1,2,3,4].map((level) => <i className={`level-${level}`} key={level}/>)}<span>多</span></div></div></Panel>
      <div className="english-summary-grid"><Panel><PanelTitle icon={Clock3}>本周学习</PanelTitle><strong className="category-value"><CountUp value={weeklyMinutes}/> min</strong><small>完成目标 {Math.round(weeklyMinutes/goals.weeklyEnglishMinutes*100)}%</small></Panel><Panel><PanelTitle icon={Languages}>累计单词</PanelTitle><strong className="category-value"><CountUp value={entries.reduce((sum,item) => sum + item.words,0)}/> 词</strong><small>持续扩大词汇量</small></Panel><Panel><PanelTitle icon={Save}>累计练习</PanelTitle><strong className="category-value"><CountUp value={entries.reduce((sum,item) => sum + item.exercises,0)}/> 组</strong><small>四项能力持续训练</small></Panel></div>
    </div>
  );
}
