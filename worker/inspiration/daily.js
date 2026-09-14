const platformNames = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  web: "网页",
};

const clean = (value) => String(value || "").trim();
const coverValue = (value) => clean(value);

function platformFor(value) {
  const platform = clean(value).toLowerCase();
  if (platform === "douyin" || platform === "抖音") return "douyin";
  if (platform === "xiaohongshu" || platform === "小红书") return "xiaohongshu";
  return "web";
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  try {
    const parsed = JSON.parse(clean(value) || "[]");
    return Array.isArray(parsed) ? parsed.map(clean).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function sourceFor(row) {
  const author = clean(row.author);
  if (author) return author;
  try {
    const hostname = new URL(clean(row.url)).hostname.replace(/^www\./, "");
    if (hostname) return hostname;
  } catch {}
  return platformNames[platformFor(row.platform)] || "灵感库";
}

export function dailyInspirationOffset(userId, date, count) {
  if (!Number.isInteger(count) || count <= 0) return -1;
  let hash = 2166136261;
  for (const character of `${clean(userId)}:${clean(date)}`) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

export function dailyInspirationResponse(row, userId) {
  if (!row) return null;
  const storedId = clean(row.id);
  const prefix = `${clean(userId)}:`;
  const legacyImage = coverValue(row.image);
  return {
    id: storedId.startsWith(prefix) ? storedId.slice(prefix.length) : storedId,
    title: clean(row.title || row.content) || "未命名灵感",
    cover: coverValue(row.cover) || legacyImage,
    image: legacyImage,
    platform: platformFor(row.platform),
    category_name: clean(row.categoryName || row.category_name) || "未分类",
    source: sourceFor(row),
    ai_tags: parseTags(row.aiTags || row.ai_tags),
  };
}
