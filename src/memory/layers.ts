import type { MemoryTier, WorkspaceData } from "../data/types";
import { buildKnowledgeNodes } from "../knowledge/graph";
import { daysAgoISO } from "../services/date";

export interface MemoryLayerSummary {
  tier: MemoryTier;
  label: string;
  count: number;
  description: string;
  highlights: string[];
}

export function buildMemoryLayers(data: WorkspaceData): MemoryLayerSummary[] {
  const recent = daysAgoISO(6);
  const shortHighlights = [
    ...data.todos.filter((item) => item.createdAt.slice(0, 10) >= recent).map((item) => item.title),
    ...data.moods.filter((item) => item.date >= recent).map((item) => `${item.mood} · ${item.story}`),
    ...data.learning.filter((item) => item.date >= recent).map((item) => item.title),
  ].filter(Boolean).slice(0, 4);
  const knowledgeNodes = buildKnowledgeNodes(data);
  const knowledgeHighlights = knowledgeNodes.slice(0, 4).map((node) => node.title);

  return [
    { tier: "short", label: "Short Memory", count: shortHighlights.length, description: "最近发生的事情与当前状态", highlights: shortHighlights },
    { tier: "long", label: "Long Memory", count: data.memories.length, description: "偏好、兴趣、习惯、目标与经历", highlights: data.memories.slice(0, 4).map((item) => item.title) },
    { tier: "knowledge", label: "Knowledge Memory", count: knowledgeNodes.length, description: "学习、灵感与个人知识连接", highlights: knowledgeHighlights },
  ];
}

