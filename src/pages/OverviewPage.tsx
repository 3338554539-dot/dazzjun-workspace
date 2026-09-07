import { ArrowRight, BookOpen, Check, CheckCircle2, Dumbbell, Flame, Heart, Languages, Lightbulb, Sparkles, Target } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { inspirationApi, type DailyInspiration } from "../api/client";
import { GrowthRings, HabitTracker, YearOverview } from "../components/GrowthDashboard";
import { CountUp, Panel, PanelTitle } from "../components/ui";
import { useWorkspaceStats } from "../hooks/useWorkspaceStats";
import { getGreeting } from "../services/date";
import { inspirationCoverCandidates, inspirationSourceLabel } from "../services/inspirationLibrary";

function DailyInspirationCover({ inspiration }: { inspiration: DailyInspiration }) {
  const [coverIndex, setCoverIndex] = useState(0);
  const candidates = inspirationCoverCandidates(inspiration, false);
  if (!candidates[coverIndex]) return <div className="inspiration-cover-empty"><Lightbulb size={26}/></div>;
  return <img src={candidates[coverIndex]} alt={inspiration.title} onError={() => setCoverIndex((current) => current + 1)}/>;
}

export function OverviewPage() {
  const [dailyInspiration, setDailyInspiration] = useState<DailyInspiration | null>();
  const stats = useWorkspaceStats();
  const { todayTodo, learningMinutes, englishMinutes, fitness: fitnessStats, latestMood: mood, goals, growth } = stats;
  const streak = stats.englishStreak;
  const todayTasks = stats.todayTasks.slice(0, 5);
  const todayLabel = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" }).format(new Date()).replaceAll("/", ".");
  const currentStatus = stats.moodToday ? `${stats.moodToday.mood} · ${stats.moodToday.score}分` : growth.overall >= 70 ? "节奏很好" : growth.overall >= 40 ? "专注进行中" : "慢慢进入状态";

  useEffect(() => {
    let active = true;
    inspirationApi.random()
      .then((inspiration) => { if (active) setDailyInspiration(inspiration); })
      .catch(() => { if (active) setDailyInspiration(null); });
    return () => { active = false; };
  }, []);

  const statusCards = [
    { label: "学习状态", value: `${learningMinutes} min`, meta: `本周目标 ${goals.weeklyLearningMinutes} min`, icon: BookOpen },
    { label: "英语状态", value: `${streak} 天`, meta: `本周 ${englishMinutes} 分钟`, icon: Languages },
    { label: "健身状态", value: `${fitnessStats.sessions} 次`, meta: `${fitnessStats.calories} kcal`, icon: Dumbbell },
    { label: "情绪状态", value: mood?.mood ?? "待记录", meta: mood ? `${mood.date} · ${mood.score} 分` : "今天写下感受", icon: Heart },
  ];

  return (
    <div className="dashboard-v3">
      <motion.section className="today-status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div><span>TODAY · PERSONAL DASHBOARD</span><h1>{getGreeting()}</h1><p>{todayLabel}</p></div>
        <div className="today-completion"><span>今天完成</span><strong><CountUp value={growth.overall}/><small>%</small></strong><i>{currentStatus}</i></div>
        <Sparkles className="today-spark" size={22}/>
      </motion.section>

      <div className="dashboard-main page-grid">
        <Panel className="dashboard-progress-card growth-center-card">
          <PanelTitle icon={Target} action={<span className="live-badge">LIVE DATA</span>}>个人成长环</PanelTitle>
          <GrowthRings values={growth}/>
        </Panel>
        <Panel className="today-plan-card">
          <PanelTitle icon={CheckCircle2} action={<button className="text-action">查看任务 <ArrowRight size={15}/></button>}>今日计划</PanelTitle>
          <div className="mini-task-list">{todayTasks.length ? todayTasks.map((task) => <div key={task.id}><span className={`mini-check ${task.done ? "checked" : ""}`}>{task.done ? <Check size={13}/> : null}</span><strong>{task.title} · {task.category} · {task.priority}优先</strong><time>{task.startAt.slice(11,16)}–{task.deadline.slice(11,16)}</time></div>) : <p className="empty-inline">今天还没有任务</p>}</div>
          <div className="dashboard-goal-line"><span style={{ width: `${growth.task}%` }}/></div>
          <small className="dashboard-caption">今日任务完成度 {growth.task}% · 今日任务 {todayTodo.done}/{todayTodo.total}</small>
        </Panel>
        <Panel className="inspiration-moment">
          <PanelTitle icon={Lightbulb} action={<span className="muted-label">收藏 {stats.inspirationSaved} · 今日新增 {stats.inspirationToday}</span>}>灵感时刻</PanelTitle>
          {dailyInspiration === undefined ? <div className="inspiration-moment-skeleton" aria-label="正在加载今日灵感"/> : dailyInspiration ? <>
            <DailyInspirationCover key={dailyInspiration.id} inspiration={dailyInspiration}/>
            <div className="inspiration-moment-copy"><strong>{dailyInspiration.title}</strong><span>来源：{inspirationSourceLabel(dailyInspiration.platform)} · {dailyInspiration.category_name}</span></div>
          </> : <div className="inspiration-moment-empty"><Lightbulb size={25}/><strong>暂无灵感</strong><span>去灵感库添加第一条</span></div>}
        </Panel>
      </div>

      <div className="status-card-grid">{statusCards.map((card, index) => <motion.article whileHover={{ y: -5 }} whileTap={{ scale: .985 }} transition={{ duration: .25 }} className="status-card" key={card.label}><card.icon size={19}/><div><small>{card.label}</small><strong>{card.value}</strong><span>{card.meta}</span></div><i>{String(index + 1).padStart(2,"0")}</i></motion.article>)}</div>

      <HabitTracker streaks={stats.habitStreaks}/>
      <YearOverview data={stats.year}/>

      <Panel className="habit-strip"><PanelTitle icon={Target}>阶段目标联动</PanelTitle><div className="habit-items"><span><b>{streak}</b>英语连续天数</span><span><b>{fitnessStats.sessions}/{goals.weeklyFitnessSessions}</b>本周健身</span><span><b>{learningMinutes}/{goals.weeklyLearningMinutes}</b>学习分钟</span><span><b>{stats.inspirationMonth}/{goals.monthlyInspirationTarget}</b>本月灵感</span></div></Panel>
    </div>
  );
}
