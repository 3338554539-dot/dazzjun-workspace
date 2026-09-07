import type { PerceptionSnapshot, WorkspaceData, WorkspaceModule } from "../data/types";
import { habitStreak } from "../services/analytics";
import { daysAgoISO } from "../services/date";

const dateOf = (value: string) => value.slice(0, 10);

export function buildPerceptionSnapshot(data: WorkspaceData, windowDays = 7): PerceptionSnapshot {
  const start = daysAgoISO(windowDays - 1);
  const recentUsage = data.usageEvents.filter((event) => dateOf(event.occurredAt) >= start);
  const moduleCounts = new Map<WorkspaceModule, number>();
  recentUsage.forEach((event) => moduleCounts.set(event.module, (moduleCounts.get(event.module) ?? 0) + 1));
  const topModule = [...moduleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "overview";
  const tasks = data.todos.filter((item) => item.scheduleDate >= start);
  const learning = data.learning.filter((item) => item.date >= start);
  const english = data.english.filter((item) => item.date >= start && item.checkedIn);
  const fitness = data.fitness.filter((item) => item.date >= start && item.completed);
  const moods = data.moods.filter((item) => item.date >= start);
  const inspirations = data.inspirations.filter((item) => dateOf(item.createdAt) >= start).length + data.inspirationNotes.filter((item) => dateOf(item.createdAt) >= start).length;
  const habitData = { todos: data.todos, learning: data.learning, english: data.english, fitness: data.fitness, inspirationNotes: data.inspirationNotes, habitCompletions: data.habitCompletions };
  const habitContinuity = Math.max(...(["reading", "english", "fitness", "writing", "sleep"] as const).map((habit) => habitStreak(habit, habitData)), 0);
  const taskCompletion = tasks.length ? Math.round(tasks.filter((item) => item.done).length / tasks.length * 100) : 0;
  const learningMinutes = learning.reduce((sum, item) => sum + item.duration, 0);
  const englishMinutes = english.reduce((sum, item) => sum + item.duration, 0);
  const moodAverage = moods.length ? Math.round(moods.reduce((sum, item) => sum + item.score, 0) / moods.length) : 0;

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    openCount: recentUsage.length,
    activeModules: moduleCounts.size,
    topModule,
    taskCompletion,
    learningMinutes,
    englishMinutes,
    fitnessSessions: fitness.length,
    moodAverage,
    inspirationCount: inspirations,
    habitContinuity,
    signals: [
      { label: "行动完成", value: `${taskCompletion}%`, tone: taskCompletion >= 70 ? "stable" : "attention" },
      { label: "学习投入", value: `${learningMinutes + englishMinutes}m`, tone: learningMinutes + englishMinutes >= 180 ? "rising" : "attention" },
      { label: "身体节奏", value: `${fitness.length} 次`, tone: fitness.length >= 3 ? "stable" : "attention" },
      { label: "情绪能量", value: moodAverage ? `${moodAverage}` : "待感知", tone: moodAverage >= 65 ? "stable" : "attention" },
      { label: "创意积累", value: `+${inspirations}`, tone: inspirations >= 3 ? "rising" : "stable" },
    ],
  };
}
