import type { AIInsightRecord, AIInsightType, WorkspaceData } from "../data/types";
import { currentWeekItems, fitnessThisWeek, growthMetrics, learningMinutesThisWeek, yearOverview } from "../services/analytics";
import { todayISO, weekMeta } from "../services/date";
import { richTextToPlainText } from "../services/richText";
import { getTodayTasks } from "../services/todoSelectors";

const joinOr = (values: string[], fallback: string) => values.length ? values.join("、") : fallback;

function dailyInsight(data: WorkspaceData) {
  const today = todayISO();
  const tasks = getTodayTasks(data.todos, today);
  const completed = tasks.filter((item) => item.done);
  const learning = data.learning.filter((item) => item.date === today);
  const english = data.english.find((item) => item.date === today && item.checkedIn);
  const fitness = data.fitness.filter((item) => item.date === today && item.completed);
  const mood = data.moods.find((item) => item.date === today);
  const inspirations = data.inspirations.filter((item) => item.createdAt.startsWith(today)).length + data.inspirationNotes.filter((item) => item.createdAt.startsWith(today)).length;
  const growth = growthMetrics({ todos: data.todos, learning: data.learning, english: data.english, fitness: data.fitness, moods: data.moods });
  return {
    title: `${today} · 每日成长总结`,
    summary: `今天的综合成长完成度为 ${growth.overall}%。${completed.length ? "行动已经留下清晰痕迹。" : "给自己一个小而明确的开始。"}`,
    sections: [
      { title: "今天完成了什么", content: completed.length ? `完成 ${completed.length}/${tasks.length} 项任务：${joinOr(completed.map((item) => item.title), "暂无")}` : `今天有 ${tasks.length} 项计划，尚未标记完成。` },
      { title: "今天学到了什么", content: learning.length || english ? `${joinOr(learning.map((item) => `${item.title}（${item.duration}分钟）`), "暂无学习日志")}${english ? `；英语训练 ${english.duration} 分钟、${english.words} 个单词。` : ""}` : "今天还没有学习记录，可以从 20 分钟专注开始。" },
      { title: "今天状态如何", content: `${mood ? `心情是“${mood.mood}”，状态评分 ${mood.score}。` : "心情尚未记录。"}${fitness.length ? ` 完成 ${fitness.length} 次运动。` : " 今日尚无运动记录。"}${inspirations ? ` 新增 ${inspirations} 条灵感。` : ""}` },
      { title: "明天建议", content: growth.task < 60 ? "先完成一件最重要的任务，再进入学习或创作；把注意力留给真正重要的事情。" : "延续今天的节奏，为明天预留一个不被打扰的深度工作时段。" },
    ],
  };
}

function weeklyInsight(data: WorkspaceData) {
  const week = weekMeta();
  const tasks = data.todos.filter((item) => item.scheduleDate >= week.start && item.scheduleDate <= week.end);
  const completed = tasks.filter((item) => item.done);
  const learning = currentWeekItems(data.learning);
  const english = currentWeekItems(data.english).filter((item) => item.checkedIn);
  const fitness = fitnessThisWeek(data.fitness);
  const moods = currentWeekItems(data.moods);
  const inspirationCount = data.inspirations.filter((item) => item.createdAt >= week.start && item.createdAt <= week.end).length + data.inspirationNotes.filter((item) => item.createdAt.slice(0, 10) >= week.start && item.createdAt.slice(0, 10) <= week.end).length;
  const averageMood = moods.length ? Math.round(moods.reduce((sum, item) => sum + item.score, 0) / moods.length) : 0;
  return {
    title: `第 ${week.weekNumber} 周 · Weekly Growth Report`,
    summary: `本周完成 ${completed.length} 项任务，累计学习 ${learningMinutesThisWeek(data.learning) + english.reduce((sum, item) => sum + item.duration, 0)} 分钟。`,
    sections: [
      { title: "本周完成", content: `${completed.length}/${tasks.length || 0} 项任务完成。${joinOr(completed.slice(0, 4).map((item) => item.title), "尚无完成记录")}` },
      { title: "学习成长", content: `${learning.length} 条学习日志，英语打卡 ${english.length} 天；重点内容：${joinOr(learning.slice(0, 3).map((item) => item.title), "待记录")}` },
      { title: "身体状态", content: `运动 ${fitness.sessions} 次、${fitness.minutes} 分钟，累计消耗 ${fitness.calories} kcal。` },
      { title: "情绪变化", content: moods.length ? `记录 ${moods.length} 天，平均状态 ${averageMood} 分；最近一次为“${moods.at(-1)?.mood}”。` : "本周尚未记录情绪变化。" },
      { title: "灵感积累", content: `新增 ${inspirationCount} 条灵感或文字记录，个人创意数据库正在持续生长。` },
      { title: "下周建议", content: fitness.sessions < data.goals.weeklyFitnessSessions ? "下周优先锁定运动时间，同时保留稳定的学习节奏。" : "延续当前节奏，并从本周记录中选择一个主题深入创作。" },
    ],
  };
}

function inspirationInsight(data: WorkspaceData) {
  const tagCounts = new Map<string, number>();
  const categoryNames = new Map(data.inspirationCategories.map((item) => [item.id, item.name]));
  [...data.inspirations.map((item) => categoryNames.get(item.categoryId) ?? "未分类"), ...data.inspirationNotes.flatMap((item) => item.tags)].forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1));
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const noteKeywords = data.inspirationNotes.slice(0, 5).map((item) => richTextToPlainText(item.content).slice(0, 28));
  return {
    title: "个人创意数据库分析",
    summary: `已分析 ${data.inspirations.length} 条外部灵感与 ${data.inspirationNotes.length} 条文字记录。`,
    sections: [
      { title: "核心主题", content: topTags.length ? topTags.map(([tag, count]) => `#${tag} ${count}`).join(" · ") : "标签仍在形成中。" },
      { title: "内容来源", content: `抖音 ${data.inspirations.filter((item) => item.platform === "douyin").length} 条，小红书 ${data.inspirations.filter((item) => item.platform === "xiaohongshu").length} 条，原创文字 ${data.inspirationNotes.length} 条。` },
      { title: "创意方向", content: topTags.slice(0, 3).length ? `当前创意重心集中在 ${topTags.slice(0, 3).map(([tag]) => tag).join("、")}，适合形成系列化表达。` : "继续记录，系统会逐渐识别你的创作方向。" },
      { title: "近期内容脉络", content: joinOr(noteKeywords, "暂无文字内容可分析") },
      { title: "整理建议", content: "选择两个高频标签建立连接，把一条外部灵感、一条学习记录和一段原创文字组合成新的创作主题。" },
    ],
  };
}

function monthlyInsight(data: WorkspaceData) {
  const month = todayISO().slice(0, 7);
  const tasks = data.todos.filter((item) => item.scheduleDate.startsWith(month));
  const completed = tasks.filter((item) => item.done);
  const learning = data.learning.filter((item) => item.date.startsWith(month));
  const english = data.english.filter((item) => item.date.startsWith(month) && item.checkedIn);
  const fitness = data.fitness.filter((item) => item.date.startsWith(month) && item.completed);
  const moods = data.moods.filter((item) => item.date.startsWith(month));
  const inspirationCount = data.inspirations.filter((item) => item.createdAt.startsWith(month)).length + data.inspirationNotes.filter((item) => item.createdAt.startsWith(month)).length;
  const learningMinutes = learning.reduce((sum, item) => sum + item.duration, 0) + english.reduce((sum, item) => sum + item.duration, 0);
  const moodAverage = moods.length ? Math.round(moods.reduce((sum, item) => sum + item.score, 0) / moods.length) : 0;
  const allocation = [
    ["学习", learningMinutes],
    ["运动", fitness.reduce((sum, item) => sum + item.duration, 0)],
    ["创作", inspirationCount * 20],
  ].sort((a, b) => Number(b[1]) - Number(a[1]));
  return {
    title: `${month} · Monthly Growth Analysis`,
    summary: `本月完成 ${completed.length} 项任务，投入 ${learningMinutes} 分钟学习，形成 ${inspirationCount} 条创意积累。`,
    sections: [
      { title: "习惯变化", content: `英语打卡 ${english.length} 天，运动 ${fitness.length} 次；当前最稳定的节奏是${english.length >= fitness.length ? "英语学习" : "身体训练"}。` },
      { title: "成长趋势", content: `任务完成率 ${tasks.length ? Math.round(completed.length / tasks.length * 100) : 0}%，学习记录 ${learning.length} 条，情绪均值 ${moodAverage || "待记录"}${moodAverage ? " 分" : ""}。` },
      { title: "时间分配", content: `${allocation.map(([name, value]) => `${name} ${value}m`).join(" · ")}。投入最多的方向是${allocation[0]?.[0] ?? "待形成"}。` },
      { title: "创作积累", content: `本月新增 ${inspirationCount} 条灵感或文字记录，适合从高频标签中选择一个主题形成阶段作品。` },
      { title: "下月策略", content: "保留最稳定的一项习惯，再选择一个当前薄弱方向做最小增量，避免同时扩大所有目标。" },
    ],
  };
}

function annualInsight(data: WorkspaceData) {
  const year = yearOverview({ todos: data.todos, learning: data.learning, english: data.english, fitness: data.fitness, inspirationNotes: data.inspirationNotes, habitCompletions: data.habitCompletions, inspirations: data.inspirations });
  const completedTasks = data.todos.filter((item) => item.done && (item.completedAt ?? item.scheduleDate ?? item.deadline).startsWith(year.year));
  const moods = data.moods.filter((item) => item.date.startsWith(year.year));
  const moodAverage = moods.length ? Math.round(moods.reduce((sum, item) => sum + item.score, 0) / moods.length) : 0;
  const reviewHighlights = data.weeklyReviews.filter((item) => item.end.startsWith(year.year) && item.highlights).flatMap((item) => item.highlights.split("\n").filter(Boolean)).slice(0, 5);
  return {
    title: `${year.year} · Personal Growth Archive`,
    summary: `这一年已沉淀 ${year.learningSessions} 次学习、${year.fitnessSessions} 次运动与 ${year.notes + year.inspirations} 条创意记录。`,
    sections: [
      { title: "年度行动", content: `完成 ${completedTasks.length} 项任务，最佳连续习惯 ${year.bestStreak} 天。${joinOr(completedTasks.slice(0, 4).map((item) => item.title), "仍在积累年度行动")}` },
      { title: "知识成长", content: `累计学习 ${year.learningMinutes} 分钟，形成 ${year.learningSessions} 次学习会话；知识网络正在把学习、灵感与复盘连接起来。` },
      { title: "身体与情绪", content: `完成 ${year.fitnessSessions} 次运动，年度情绪均值 ${moodAverage || "待记录"}${moodAverage ? " 分" : ""}。` },
      { title: "创意资产", content: `收藏 ${year.inspirations} 条外部灵感，写下 ${year.notes} 条原创记录。` },
      { title: "年度高光", content: joinOr(reviewHighlights, "在周复盘中写下高光后，年度档案会逐渐形成。") },
      { title: "下一阶段", content: "从年度数据里保留一个长期主题：持续行动、身体能量或创作输出，让它成为下一年的主轴。" },
    ],
  };
}

function growthInsight(data: WorkspaceData) {
  const weeklyFitness = fitnessThisWeek(data.fitness);
  const learningMinutes = learningMinutesThisWeek(data.learning);
  const moodAverage = data.moods.length ? Math.round(data.moods.slice(-14).reduce((sum, item) => sum + item.score, 0) / Math.min(14, data.moods.length)) : 0;
  return {
    title: "个人成长建议",
    summary: "基于学习、习惯、运动、情绪与创作数据生成的本地建议。",
    sections: [
      { title: "学习计划", content: learningMinutes < data.goals.weeklyLearningMinutes ? `本周还差 ${Math.max(0, data.goals.weeklyLearningMinutes - learningMinutes)} 分钟，建议拆成 2–3 个专注时段。` : "本周学习目标已经达成，可以转向复述和输出。" },
      { title: "习惯调整", content: "把英语、阅读与写作串成一条低阻力链路：输入 20 分钟，摘录 1 条，再写下 100 字。" },
      { title: "时间管理", content: "优先保护每天第一个完整的 60 分钟，减少任务切换；用周复盘确认时间是否投入到长期目标。" },
      { title: "身体与情绪", content: `本周运动 ${weeklyFitness.sessions} 次，近期情绪均值 ${moodAverage || "待记录"}${moodAverage ? " 分" : ""}。${weeklyFitness.sessions < data.goals.weeklyFitnessSessions ? "建议提前预约下一次运动。" : "当前运动节奏稳定。"}` },
      { title: "创作方向", content: "从灵感库高频标签中选择一个主题，关联学习日志与文字记录，形成可持续迭代的创作母题。" },
    ],
  };
}

export function generateLocalInsight(type: AIInsightType, data: WorkspaceData): Omit<AIInsightRecord, "id"> {
  const content = type === "daily" ? dailyInsight(data) : type === "weekly" ? weeklyInsight(data) : type === "monthly" ? monthlyInsight(data) : type === "annual" ? annualInsight(data) : type === "inspiration" ? inspirationInsight(data) : growthInsight(data);
  return { type, ...content, generatedAt: new Date().toISOString(), engine: "local-insight" };
}
