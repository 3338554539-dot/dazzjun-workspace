export const emptyWorkspace = {
  todos: [], moods: [], learning: [], english: [], fitness: [], weeklyReviews: [], inspirations: [],
  inspirationCategories: [],
  inspirationNotes: [], inspirationTags: ["创意", "设计", "写作", "商业", "AI", "学习", "金句", "生活"],
  habitCompletions: [], inspirationLinks: [], aiInsights: [], knowledgeLinks: [], memories: [], usageEvents: [], aiNotifications: [],
  goals: { weeklyTodoTarget: 10, weeklyLearningMinutes: 300, weeklyEnglishMinutes: 280, weeklyFitnessSessions: 4, monthlyInspirationTarget: 30 },
};

export const legacyPresetCategoryIds = new Set(["design", "ai", "photography", "fashion", "music", "business"]);
export const cleanCategoryName = (value) => String(value || "").trim().replace(/^[。、\s]+|[。、\s]+$/g, "").trim();
const normalizeInspirationPlatform = (value) => value === "douyin" || value === "抖音" ? "douyin" : value === "xiaohongshu" || value === "小红书" ? "xiaohongshu" : "web";
const portalForPlatform = (platform) => platform === "xiaohongshu" ? "小红书" : "抖音";
const cleanTags = (value) => Array.isArray(value) ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12) : [];
const learningAssetUrl = (assetId, thumbnail = false) => `/api/learning/assets/${encodeURIComponent(assetId)}${thumbnail ? "?variant=thumbnail" : ""}`;

export function normalizeLearningBlocks(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const id = String(item.id || `block-${index}`).slice(0, 120);
    if (item.type === "text") return [{ id, type: "text", content: String(item.content || "").slice(0, 50_000) }];
    if (item.type === "image" || item.type === "file") {
      const assetId = String(item.assetId || item.id || "").slice(0, 120);
      if (!assetId) return [];
      const common = { id, assetId, url: learningAssetUrl(assetId), name: String(item.name || (item.type === "image" ? "学习图片" : "学习附件")).slice(0, 240), size: Math.max(0, Number(item.size) || 0), mime: String(item.mime || "").slice(0, 160), createdAt: String(item.createdAt || new Date().toISOString()) };
      return item.type === "image" ? [{ ...common, type: "image", thumbnail: learningAssetUrl(assetId, true) }] : [{ ...common, type: "file" }];
    }
    if (item.type === "link") {
      try {
        const url = new URL(String(item.url || ""));
        if (!/^https?:$/.test(url.protocol)) return [];
        return [{ id, type: "link", url: url.toString(), title: String(item.title || url.hostname).slice(0, 300), favicon: String(item.favicon || "").slice(0, 2_048), siteName: String(item.siteName || url.hostname).slice(0, 160), description: String(item.description || "").slice(0, 500) }];
      } catch { return []; }
    }
    return [];
  }).slice(0, 200);
}

function normalizeLearningEntries(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    ...item,
    id: String(item?.id || crypto.randomUUID()),
    date: String(item?.date || new Date().toISOString().slice(0, 10)),
    title: String(item?.title || "未命名学习记录"),
    category: ["书籍", "课程", "技能", "文章"].includes(item?.category) ? item.category : "书籍",
    content: String(item?.content ?? item?.learningContent ?? ""),
    duration: Math.max(0, Number(item?.duration) || 0),
    notes: String(item?.notes ?? item?.learningNote ?? ""),
    gain: String(item?.gain ?? item?.reflection ?? ""),
    learningBlocks: normalizeLearningBlocks(item?.learningBlocks),
    createdAt: String(item?.createdAt || new Date().toISOString()),
  }));
}

export function normalizeWorkspaceForStorage(input) {
  const rawCategories = Array.isArray(input?.inspirationCategories) ? input.inspirationCategories : [];
  const categories = rawCategories
    .filter((item) => item?.id && !legacyPresetCategoryIds.has(String(item.id)))
    .map((item, index) => ({ id: String(item.id), name: cleanCategoryName(item.name), icon: String(item.icon || ""), order: Number.isFinite(item.order) ? item.order : index, createdAt: item.createdAt || new Date().toISOString() }))
    .filter((item) => item.name)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase()) === index)
    .sort((a, b) => a.order - b.order)
    .map((item, order) => ({ ...item, order }));
  const categoriesById = new Map(categories.map((item) => [item.id, item]));
  const inspirations = (Array.isArray(input?.inspirations) ? input.inspirations : []).map((item) => {
    const platform = normalizeInspirationPlatform(item.platform);
    const categoryId = categoriesById.has(String(item.categoryId || "")) ? String(item.categoryId) : "";
    const title = String(item.title || item.content || "收藏内容").trim() || "收藏内容";
    const cover = String(item.cover || item.image || "");
    return { ...item, platform, portal: item.portal === "小红书" || item.portal === "抖音" ? item.portal : portalForPlatform(platform), title, content: title, cover, image: cover, author: String(item.author || ""), sourceText: String(item.sourceText || item.source_text || ""), categoryId, categoryName: categoriesById.get(categoryId)?.name || "", aiTags: cleanTags(item.aiTags || item.ai_tags), url: String(item.url || ""), createdAt: String(item.createdAt || new Date().toISOString()), saved: item.saved !== false };
  });
  return { ...structuredClone(emptyWorkspace), ...input, learning: normalizeLearningEntries(input?.learning), inspirationCategories: categories, inspirations };
}

export const defaultPreferences = { themeId: "cosmic", customThemes: [] };
