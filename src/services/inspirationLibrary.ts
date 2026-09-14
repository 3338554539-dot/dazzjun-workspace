import type { InspirationItem, InspirationPlatform } from "../data/types";

export const inspirationSourceLabel = (source: InspirationPlatform) => source === "douyin" ? "抖音" : source === "xiaohongshu" ? "小红书" : "网页";

const defaultCoverBySource: Record<InspirationPlatform, string> = {
  douyin: "/assets/inspiration-ribbons.png",
  xiaohongshu: "/assets/inspiration-sea.png",
  web: "/assets/inspiration-ribbons.png",
};

export function isDefaultInspirationCover(value?: string) {
  return /^\/assets\/inspiration-(?:ribbons|sea)\.png$/u.test(String(value || "").trim());
}

export function needsInspirationCoverRefresh(record: { cover?: string; image?: string; coverType?: string }) {
  if (record.coverType === "fallback") return true;
  const candidates = [record.cover, record.image].map((value) => String(value || "").trim()).filter(Boolean);
  return !candidates.length || candidates.every(isDefaultInspirationCover);
}

export function inspirationCoverCandidates(
  record: { cover?: string; image?: string; platform: InspirationPlatform },
  includeDefault = true,
) {
  const candidates = [record.cover, record.image, includeDefault ? defaultCoverBySource[record.platform] : ""]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return [...new Set(candidates)];
}

export function filterUnifiedInspirations(
  items: InspirationItem[],
  categoryId: string,
  query: string,
  categoryNames: Map<string, string>,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    if (categoryId !== "全部" && item.categoryId !== categoryId) return false;
    if (!normalizedQuery) return true;
    const searchable = [
      item.title,
      item.author,
      item.aiTags.join(" "),
      item.url,
      item.categoryName || categoryNames.get(item.categoryId) || "",
      inspirationSourceLabel(item.platform),
      item.platform,
    ].join(" ").toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}
