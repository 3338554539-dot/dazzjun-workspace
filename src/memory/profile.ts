import type { MemoryKind, WorkspaceData } from "../data/types";

export interface MemorySignal { kind: MemoryKind; title: string; value: string; confidence: number }

export function inferMemorySignals(data: WorkspaceData): MemorySignal[] {
  const categoryNames = new Map(data.inspirationCategories.map((item) => [item.id, item.name]));
  const tags = [...data.inspirations.map((item) => categoryNames.get(item.categoryId) ?? "未分类"), ...data.inspirationNotes.flatMap((item) => item.tags)];
  const counts = new Map<string, number>();
  tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  const topTags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tag]) => tag);
  const learningCategories = new Map<string, number>();
  data.learning.forEach((item) => learningCategories.set(item.category, (learningCategories.get(item.category) ?? 0) + 1));
  const favoriteLearning = [...learningCategories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return [
    { kind: "Interest", title: "高频灵感主题", value: topTags.length ? topTags.join("、") : "正在学习你的内容偏好", confidence: Math.min(96, 55 + tags.length * 3) },
    { kind: "Habit", title: "英语学习节奏", value: `已积累 ${data.english.filter((item) => item.checkedIn).length} 次英语打卡`, confidence: 92 },
    { kind: "Preference", title: "学习内容偏好", value: favoriteLearning ? `更常记录${favoriteLearning}类学习内容` : "尚未形成明显偏好", confidence: favoriteLearning ? 78 : 35 },
    { kind: "Goal", title: "当前阶段目标", value: `每周学习 ${data.goals.weeklyLearningMinutes} 分钟，运动 ${data.goals.weeklyFitnessSessions} 次`, confidence: 100 },
  ];
}
