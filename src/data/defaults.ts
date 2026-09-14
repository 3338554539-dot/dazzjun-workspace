import type { InspirationCategory, InspirationCoverType, InspirationItem, InspirationPlatform, LearningBlock, LearningEntry, TodoItem, WorkspaceData } from "./types";

export const defaultInspirationCategories: InspirationCategory[] = [];
export const legacyPresetCategoryIds = new Set(["design", "ai", "photography", "fashion", "music", "business"]);

export function cleanCategoryName(value: string) {
  return value.trim().replace(/^[。、\s]+|[。、\s]+$/g, "").trim();
}

export const defaultWorkspaceData: WorkspaceData = {
  todos: [],
  moods: [],
  learning: [],
  english: [],
  fitness: [],
  weeklyReviews: [],
  inspirations: [],
  inspirationCategories: defaultInspirationCategories,
  inspirationNotes: [],
  inspirationTags: ["创意", "设计", "写作", "商业", "AI", "学习", "金句", "生活"],
  habitCompletions: [],
  inspirationLinks: [],
  aiInsights: [],
  knowledgeLinks: [],
  memories: [],
  usageEvents: [],
  aiNotifications: [],
  goals: { weeklyTodoTarget: 10, weeklyLearningMinutes: 300, weeklyEnglishMinutes: 280, weeklyFitnessSessions: 4, monthlyInspirationTarget: 30 },
};

type LegacyInspiration = Partial<Omit<InspirationItem, "platform">> & { platform?: InspirationPlatform | "抖音" | "小红书"; title?: string; source?: string; category?: string; tags?: string[] };
type LegacyTodo = Partial<TodoItem> & { dueAt?: string };
type LegacyLearning = Partial<LearningEntry> & { learningContent?: string; learningNote?: string; reflection?: string };
const inspirationCoverTypes = new Set<InspirationCoverType>(["video_first_frame", "video_poster", "first_image", "og_image", "main_image", "fallback"]);
const isDefaultInspirationCover = (value: string) => /^\/assets\/inspiration-(?:ribbons|sea)\.png$/u.test(value);

function normalizeLearningBlocksForWorkspace(value: unknown): LearningBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: LearningBlock[] = [];
  value.slice(0, 200).forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const item = raw as Record<string, unknown>;
    const id = String(item.id || `block-${index}`).slice(0, 120);
    if (item.type === "text") { blocks.push({ id, type: "text", content: String(item.content || "").slice(0, 50_000) }); return; }
    if (item.type === "image" || item.type === "file") {
      const assetId = String(item.assetId || item.id || "").slice(0, 120);
      if (!assetId) return;
      const url = `/api/learning/assets/${encodeURIComponent(assetId)}`;
      const common = { id, assetId, url, name: String(item.name || (item.type === "image" ? "学习图片" : "学习附件")).slice(0, 240), size: Math.max(0, Number(item.size) || 0), mime: String(item.mime || "").slice(0, 160), createdAt: String(item.createdAt || new Date().toISOString()) };
      blocks.push(item.type === "image" ? { ...common, type: "image", thumbnail: `${url}?variant=thumbnail` } : { ...common, type: "file" });
      return;
    }
    if (item.type === "link") {
      try {
        const url = new URL(String(item.url || ""));
        if (!/^https?:$/.test(url.protocol)) return;
        blocks.push({ id, type: "link", url: url.toString(), title: String(item.title || url.hostname).slice(0, 300), favicon: String(item.favicon || "").slice(0, 2_048), siteName: String(item.siteName || url.hostname).slice(0, 160), description: String(item.description || "").slice(0, 500) });
      } catch { return; }
    }
  });
  return blocks;
}

function normalizeTodo(raw: LegacyTodo): TodoItem {
  const today = new Date().toISOString().slice(0, 10);
  const scheduleDate = String(raw.scheduleDate || raw.startAt?.slice(0, 10) || raw.dueAt?.slice(0, 10) || today);
  return {
    id: raw.id || crypto.randomUUID(),
    title: String(raw.title || "未命名任务"),
    category: raw.category === "工作" || raw.category === "学习" ? raw.category : "生活",
    priority: raw.priority === "高" || raw.priority === "低" ? raw.priority : "中",
    scheduleDate,
    startAt: String(raw.startAt || `${scheduleDate}T09:00`),
    deadline: String(raw.deadline || raw.dueAt || `${scheduleDate}T23:59`),
    done: raw.done === true,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    ...(raw.completedAt ? { completedAt: String(raw.completedAt) } : {}),
  };
}

function normalizeLearning(raw: LegacyLearning): LearningEntry {
  return {
    id: String(raw.id || crypto.randomUUID()),
    date: String(raw.date || new Date().toISOString().slice(0, 10)),
    title: String(raw.title || "未命名学习记录"),
    category: raw.category === "课程" || raw.category === "技能" || raw.category === "文章" ? raw.category : "书籍",
    content: String(raw.content ?? raw.learningContent ?? ""),
    duration: Math.max(0, Number(raw.duration) || 0),
    notes: String(raw.notes ?? raw.learningNote ?? ""),
    gain: String(raw.gain ?? raw.reflection ?? ""),
    learningBlocks: normalizeLearningBlocksForWorkspace(raw.learningBlocks),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

export function normalizeWorkspaceData(input: Partial<WorkspaceData>): WorkspaceData {
  const customCategories = Array.isArray(input.inspirationCategories) ? input.inspirationCategories : [];
  const categories = customCategories
    .filter((item) => item?.id && !legacyPresetCategoryIds.has(item.id))
    .map((item, index) => ({ id: item.id, name: cleanCategoryName(item.name), icon: item.icon || "", order: Number.isFinite(item.order) ? item.order : index, createdAt: item.createdAt || new Date().toISOString() }))
    .filter((item) => item.name)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase()) === index)
    .sort((a, b) => a.order - b.order)
    .map((item, order) => ({ ...item, order }));
  const categoryByName = new Map(categories.map((item) => [item.name, item.id]));
  const inspirations = (Array.isArray(input.inspirations) ? input.inspirations : []).map((raw) => {
    const item = raw as LegacyInspiration;
    const platform = item.platform === "douyin" || item.platform === "抖音" ? "douyin" : item.platform === "xiaohongshu" || item.platform === "小红书" ? "xiaohongshu" : "web";
    const portal = item.portal === "小红书" || item.portal === "抖音" ? item.portal : platform === "xiaohongshu" ? "小红书" : "抖音";
    const categoryId = String((item.categoryId && categories.some((category) => category.id === item.categoryId) ? item.categoryId : "") || categoryByName.get(cleanCategoryName(String(item.category || ""))) || "");
    const title = String(item.title || item.content || item.source || "收藏内容");
    const cover = String(item.cover || item.image || (platform === "xiaohongshu" ? "/assets/inspiration-sea.png" : "/assets/inspiration-ribbons.png"));
    const coverType = inspirationCoverTypes.has(item.coverType as InspirationCoverType) ? item.coverType as InspirationCoverType : isDefaultInspirationCover(cover) ? "fallback" : undefined;
    const coverSource = String(item.coverSource || (coverType === "fallback" ? "" : cover));
    return {
      id: item.id || crypto.randomUUID(),
      platform,
      portal,
      title,
      cover,
      ...(coverType ? { coverType } : {}),
      ...(coverSource ? { coverSource } : {}),
      author: String(item.author || ""),
      sourceText: String(item.sourceText || item.source || ""),
      categoryId,
      categoryName: categories.find((category) => category.id === categoryId)?.name || "",
      aiTags: Array.isArray(item.aiTags) ? item.aiTags.map(String).filter(Boolean).slice(0, 12) : Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean).slice(0, 12) : [],
      content: title,
      image: cover,
      url: String(item.url || (platform === "xiaohongshu" ? "https://www.xiaohongshu.com/" : platform === "douyin" ? "https://www.douyin.com/" : "https://example.com/")),
      createdAt: String(item.createdAt || new Date().toISOString()),
      saved: item.saved !== false,
    } satisfies InspirationItem;
  });
  return {
    ...structuredClone(defaultWorkspaceData),
    ...input,
    todos: (Array.isArray(input.todos) ? input.todos : []).map((item) => normalizeTodo(item as LegacyTodo)),
    learning: (Array.isArray(input.learning) ? input.learning : []).map((item) => normalizeLearning(item as LegacyLearning)),
    inspirations,
    inspirationCategories: categories,
    inspirationNotes: input.inspirationNotes ?? [],
    inspirationTags: input.inspirationTags ?? defaultWorkspaceData.inspirationTags,
    habitCompletions: input.habitCompletions ?? [],
    inspirationLinks: input.inspirationLinks ?? [],
    aiInsights: input.aiInsights ?? [],
    knowledgeLinks: input.knowledgeLinks ?? [],
    memories: input.memories ?? [],
    usageEvents: input.usageEvents ?? [],
    aiNotifications: input.aiNotifications ?? [],
    goals: { ...defaultWorkspaceData.goals, ...(input.goals ?? {}) },
  };
}
