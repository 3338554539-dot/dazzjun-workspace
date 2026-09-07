import type { KnowledgeLink, KnowledgeNodeType, WorkspaceData } from "../data/types";
import { richTextToPlainText } from "../services/richText";

export interface KnowledgeNode {
  id: string;
  sourceId: string;
  type: KnowledgeNodeType;
  title: string;
  detail: string;
  tags: string[];
  date: string;
}

export function buildKnowledgeNodes(data: WorkspaceData): KnowledgeNode[] {
  const categoryNames = new Map(data.inspirationCategories.map((item) => [item.id, item.name]));
  return [
    ...data.inspirationNotes.map((item) => ({ id: `note:${item.id}`, sourceId: item.id, type: "note" as const, title: item.title, detail: richTextToPlainText(item.content), tags: item.tags, date: item.createdAt.slice(0, 10) })),
    ...data.learning.map((item) => ({ id: `learning:${item.id}`, sourceId: item.id, type: "learning" as const, title: item.title, detail: `${item.content} ${item.gain}`, tags: [item.category], date: item.date })),
    ...data.inspirations.map((item) => ({ id: `inspiration:${item.id}`, sourceId: item.id, type: "inspiration" as const, title: item.content, detail: item.url, tags: [categoryNames.get(item.categoryId) ?? "未分类"], date: item.createdAt })),
    ...data.weeklyReviews.filter((item) => item.completed || item.highlights).map((item) => ({ id: `weekly:${item.id}`, sourceId: item.id, type: "weekly" as const, title: `第 ${item.weekNumber} 周复盘`, detail: `${item.completed} ${item.highlights}`, tags: ["复盘"], date: item.end })),
    ...data.english.filter((item) => item.checkedIn).slice(0, 4).map((item) => ({ id: `english:${item.id}`, sourceId: item.id, type: "english" as const, title: `${item.date} 英语学习`, detail: item.note, tags: item.categories, date: item.date })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 18);
}

export function buildKnowledgeLinks(nodes: KnowledgeNode[], manual: KnowledgeLink[]) {
  const visible = new Set(nodes.map((node) => node.sourceId));
  const manualVisible = manual.filter((link) => visible.has(link.sourceId) && visible.has(link.targetId));
  const automatic: KnowledgeLink[] = [];
  nodes.forEach((node, index) => {
    nodes.slice(index + 1).forEach((candidate) => {
      if (automatic.length >= 22 || node.type === candidate.type) return;
      const shared = node.tags.find((tag) => candidate.tags.includes(tag));
      if (shared) automatic.push({ id: `auto-${node.id}-${candidate.id}`, sourceId: node.sourceId, sourceType: node.type, targetId: candidate.sourceId, targetType: candidate.type, relation: `共同主题：${shared}`, createdAt: new Date().toISOString(), source: "automatic" });
    });
  });
  return [...manualVisible, ...automatic.filter((auto) => !manualVisible.some((item) => item.sourceId === auto.sourceId && item.targetId === auto.targetId))];
}
