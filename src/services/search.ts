import type { WorkspaceData } from "../data/types";
import { inspirationSourceLabel } from "./inspirationLibrary";
import { richTextToPlainText } from "./richText";

export type SearchTarget = "todo" | "mood" | "learning" | "english" | "fitness" | "weekly" | "inspiration" | "ai";

export interface WorkspaceSearchResult {
  id: string;
  page: SearchTarget;
  module: string;
  title: string;
  detail: string;
  searchable: string;
}

export function workspaceSearchIndex(data: WorkspaceData): WorkspaceSearchResult[] {
  const categoryNames = new Map(data.inspirationCategories.map((item) => [item.id, item.name]));
  return [
    ...data.todos.map((item) => ({ id: `todo-${item.id}`, page: "todo" as const, module: "To Do List", title: item.title, detail: `${item.category} · ${item.done ? "已完成" : "进行中"}`, searchable: `${item.title} ${item.category} ${item.priority}` })),
    ...data.moods.map((item) => ({ id: `mood-${item.id}`, page: "mood" as const, module: "心情日记", title: `${item.date} · ${item.mood}`, detail: item.story || item.note || "每日心情记录", searchable: `${item.date} ${item.mood} ${item.story} ${item.note}` })),
    ...data.learning.map((item) => ({ id: `learning-${item.id}`, page: "learning" as const, module: "学习日志", title: item.title, detail: `${item.date} · ${item.duration} 分钟`, searchable: `${item.title} ${item.category} ${item.content} ${item.notes} ${item.gain}` })),
    ...data.english.map((item) => ({ id: `english-${item.id}`, page: "english" as const, module: "英语学习", title: `${item.date} 英语训练`, detail: `${item.duration} 分钟 · ${item.words} 个单词`, searchable: `${item.date} ${item.note} ${item.categories.join(" ")}` })),
    ...data.fitness.map((item) => ({ id: `fitness-${item.id}`, page: "fitness" as const, module: "健身锻炼", title: item.title, detail: `${item.date} · ${item.duration} 分钟`, searchable: `${item.title} ${item.plan} ${item.calories}` })),
    ...data.weeklyReviews.map((item) => ({ id: `weekly-${item.id}`, page: "weekly" as const, module: "周复盘", title: `第 ${item.weekNumber} 周复盘`, detail: `${item.start} - ${item.end}`, searchable: `${item.completed} ${item.obstacles} ${item.improvements} ${item.highlights}` })),
    ...data.inspirations.map((item) => ({ id: `inspiration-${item.id}`, page: "inspiration" as const, module: "收藏灵感", title: item.title, detail: `${item.categoryName || categoryNames.get(item.categoryId) || "未分类"} · 来源：${inspirationSourceLabel(item.platform)}`, searchable: `${item.title} ${item.author} ${item.aiTags.join(" ")} ${item.url} ${inspirationSourceLabel(item.platform)} ${item.platform} ${item.categoryName || categoryNames.get(item.categoryId) || ""}` })),
    ...data.inspirationNotes.map((item) => ({ id: `note-${item.id}`, page: "inspiration" as const, module: "我的笔记", title: item.title, detail: `${item.tags.map((tag) => `#${tag}`).join(" ")} · ${item.createdAt.slice(0, 10)}`, searchable: `${item.title} ${richTextToPlainText(item.content)} ${item.tags.join(" ")}` })),
    ...data.aiInsights.map((item) => ({ id: `ai-${item.id}`, page: "ai" as const, module: "AI Assistant", title: item.title, detail: item.summary, searchable: `${item.title} ${item.summary} ${item.sections.map((section) => `${section.title} ${section.content}`).join(" ")}` })),
    ...data.memories.map((item) => ({ id: `memory-${item.id}`, page: "ai" as const, module: "Dazzjun Memory", title: item.title, detail: `${item.kind} · ${item.value}`, searchable: `${item.title} ${item.kind} ${item.value}` })),
  ];
}

export function searchWorkspace(data: WorkspaceData, query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return workspaceSearchIndex(data).filter((item) => tokens.every((token) => `${item.title} ${item.detail} ${item.searchable}`.toLowerCase().includes(token))).slice(0, 24);
}
