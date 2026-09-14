import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, Save, Sparkles, Star, Zap } from "lucide-react";
import { FadeNotice, Panel, PanelTitle } from "../components/ui";
import { weekMeta } from "../services/date";
import { useWorkspaceStore } from "../store/workspaceStore";
import { useWorkspaceNavigation } from "../components/workspace/WorkspaceNavigation";

const fields = [
  { key: "completed" as const, title: "完成了什么", icon: CheckCircle2, placeholder: "本周完成的任务、习惯与阶段成果…" },
  { key: "obstacles" as const, title: "问题&阻碍", icon: Zap, placeholder: "影响节奏的问题、情绪与外部阻碍…" },
  { key: "improvements" as const, title: "下周改进", icon: ArrowRight, placeholder: "下一周希望调整的策略与行动…" },
  { key: "highlights" as const, title: "高光时刻", icon: Star, placeholder: "值得记住和庆祝的瞬间…" },
];

export function WeeklyPage() {
  const { params } = useWorkspaceNavigation();
  const reviews = useWorkspaceStore((state) => state.weeklyReviews);
  const ensure = useWorkspaceStore((state) => state.ensureWeeklyReview);
  const update = useWorkspaceStore((state) => state.updateWeeklyReview);
  const requestedWeek = params.get("week");
  const [offset, setOffset] = useState(() => {
    const target = reviews.find((item) => item.weekKey === requestedWeek);
    if (!target) return 0;
    const current = weekMeta();
    return Math.round((new Date(`${target.start}T12:00:00`).getTime() - new Date(`${current.start}T12:00:00`).getTime()) / 604800000);
  });
  const [saved, setSaved] = useState(false);
  const meta = useMemo(() => weekMeta(new Date(), offset), [offset]);
  const review = reviews.find((item) => item.weekKey === meta.weekKey);
  useEffect(() => { ensure(offset); }, [offset, ensure]);
  const saveField = (key: typeof fields[number]["key"], value: string) => { update(meta.weekKey, { [key]: value }); setSaved(true); setTimeout(() => setSaved(false), 1200); };
  const history = [...reviews].sort((a,b) => b.weekKey.localeCompare(a.weekKey));
  return (
    <div className="weekly-v2">
      <Panel className="weekly-page"><div className="week-header"><button onClick={() => setOffset(offset-1)}><ArrowLeft size={17}/>上一周</button><h2><CalendarDays size={19}/>{meta.start.replaceAll("-",".")} - {meta.end.replaceAll("-",".")}<span>第 {meta.weekNumber} 周</span></h2><button onClick={() => setOffset(offset+1)}>下一周<ArrowRight size={17}/></button></div><div className="review-grid editable">{fields.map((field) => <article className={`review-card ${field.key === "obstacles" ? "orange" : ""}`} key={field.key}><h3><field.icon size={20}/>{field.title}</h3><textarea value={review?.[field.key] ?? ""} onChange={(event) => saveField(field.key,event.target.value)} placeholder={field.placeholder}/><footer><span>{(review?.[field.key] ?? "").split("\n").filter(Boolean).length} 项记录</span>{saved && <FadeNotice><Save size={13}/>已自动保存</FadeNotice>}</footer></article>)}</div></Panel>
      <Panel className="review-timeline"><PanelTitle icon={Clock3} action={<span className="muted-label">年度成长报告接口已预留</span>}>历史时间轴</PanelTitle><div className="timeline-track">{history.map((item) => <button className={item.weekKey === meta.weekKey ? "active" : ""} key={item.id} onClick={() => { const target = new Date(`${item.start}T12:00:00`); const current = weekMeta(); setOffset(Math.round((target.getTime()-new Date(`${current.start}T12:00:00`).getTime())/604800000)); }}><i/><span>第 {item.weekNumber} 周<small>{item.start} — {item.end}</small></span><b>{[item.completed,item.obstacles,item.improvements,item.highlights].filter(Boolean).length}/4</b></button>)}</div><div className="annual-placeholder"><Sparkles size={18}/><span>年度成长报告</span><small>复盘数据持续积累后，将在这里生成年度轨迹。</small></div></Panel>
    </div>
  );
}
