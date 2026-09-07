import type { LearningBlock, LearningEntry } from "../data/types";

const clean = (value: unknown, max = 20_000) => String(value ?? "").trim().slice(0, max);
const safeAssetUrl = (value: unknown, assetId: string, thumbnail = false) => {
  const candidate = String(value ?? "");
  const expected = `/api/learning/assets/${encodeURIComponent(assetId)}`;
  return candidate.startsWith(expected) ? candidate : `${expected}${thumbnail ? "?variant=thumbnail" : ""}`;
};

export function normalizeLearningBlocks(value: unknown): LearningBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: LearningBlock[] = [];
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const item = raw as Record<string, unknown>;
    const id = clean(item.id, 120) || `block-${index}-${crypto.randomUUID()}`;
    if (item.type === "text") {
      blocks.push({ id, type: "text", content: String(item.content ?? "").slice(0, 50_000) });
      return;
    }
    if (item.type === "image" || item.type === "file") {
      const assetId = clean(item.assetId ?? item.id, 120);
      if (!assetId) return;
      const common = {
        id,
        assetId,
        name: clean(item.name, 240) || (item.type === "image" ? "学习图片" : "学习附件"),
        size: Math.max(0, Number(item.size) || 0),
        mime: clean(item.mime, 160),
        createdAt: clean(item.createdAt, 80) || new Date().toISOString(),
        url: safeAssetUrl(item.url, assetId),
      };
      blocks.push(item.type === "image"
        ? { ...common, type: "image", thumbnail: safeAssetUrl(item.thumbnail, assetId, true) }
        : { ...common, type: "file" });
      return;
    }
    if (item.type === "link") {
      try {
        const url = new URL(String(item.url ?? ""));
        if (!/^https?:$/.test(url.protocol)) return;
        blocks.push({
          id,
          type: "link" as const,
          url: url.toString(),
          title: clean(item.title, 300) || url.hostname,
          favicon: clean(item.favicon, 2_048),
          siteName: clean(item.siteName, 160) || url.hostname,
          description: clean(item.description, 500),
        });
      } catch { return; }
    }
  });
  return blocks.slice(0, 200);
}

export function learningBlocksForEntry(entry: LearningEntry): LearningBlock[] {
  const blocks = normalizeLearningBlocks(entry.learningBlocks);
  if (blocks.length) return blocks;
  return [
    entry.content && { id: `${entry.id}-content`, type: "text" as const, content: entry.content },
    entry.notes && { id: `${entry.id}-notes`, type: "text" as const, content: entry.notes },
    entry.gain && { id: `${entry.id}-gain`, type: "text" as const, content: entry.gain },
  ].filter(Boolean) as LearningBlock[];
}

export function learningSearchText(entry: LearningEntry) {
  const blocks = learningBlocksForEntry(entry).map((block) => block.type === "text" ? block.content : block.type === "link" ? `${block.title} ${block.url}` : block.name).join(" ");
  return `${entry.title} ${entry.category} ${entry.content} ${entry.notes} ${entry.gain} ${blocks}`.toLowerCase();
}

export function formatLearningFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
