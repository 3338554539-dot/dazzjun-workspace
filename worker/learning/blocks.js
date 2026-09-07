const assetUrl = (assetId, thumbnail = false) => `/api/learning/assets/${encodeURIComponent(assetId)}${thumbnail ? "?variant=thumbnail" : ""}`;

export function normalizeLearningBlocks(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const id = String(item.id || `block-${index}`).slice(0, 120);
    if (item.type === "text") return [{ id, type: "text", content: String(item.content || "").slice(0, 50_000) }];
    if (item.type === "image" || item.type === "file") {
      const assetId = String(item.assetId || item.id || "").slice(0, 120);
      if (!assetId) return [];
      const block = { id, assetId, type: item.type, url: assetUrl(assetId), name: String(item.name || (item.type === "image" ? "学习图片" : "学习附件")).slice(0, 240), size: Math.max(0, Number(item.size) || 0), mime: String(item.mime || "").slice(0, 160), createdAt: String(item.createdAt || new Date().toISOString()) };
      return item.type === "image" ? [{ ...block, thumbnail: assetUrl(assetId, true) }] : [block];
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

export function normalizeLearningEntries(value) {
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
