import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterUnifiedInspirations, inspirationCoverCandidates, inspirationSourceLabel } from "../src/services/inspirationLibrary.ts";

const item = (overrides) => ({
  id: crypto.randomUUID(),
  platform: "web",
  portal: "抖音",
  title: "普通网页灵感",
  cover: "",
  author: "",
  sourceText: "",
  categoryName: "设计",
  aiTags: [],
  content: "",
  image: "",
  url: "https://example.com",
  categoryId: "design",
  createdAt: "2026-08-03",
  saved: true,
  ...overrides,
});

const legacyItems = [
  item({ id: "douyin-old", platform: "douyin", portal: "抖音", title: "镜头节奏", categoryId: "video", categoryName: "视频" }),
  item({ id: "xiaohongshu-old", platform: "xiaohongshu", portal: "小红书", title: "穿搭配色", categoryId: "fashion", categoryName: "穿搭" }),
  item({ id: "web-new", platform: "web", portal: "抖音", title: "设计文章" }),
];

test("unified collection includes legacy Douyin, Xiaohongshu and web records regardless of portal", () => {
  const result = filterUnifiedInspirations(legacyItems, "全部", "", new Map());
  assert.deepEqual(result.map((entry) => entry.id), ["douyin-old", "xiaohongshu-old", "web-new"]);
});

test("user categories remain the only category filter", () => {
  const result = filterUnifiedInspirations(legacyItems, "fashion", "", new Map());
  assert.deepEqual(result.map((entry) => entry.id), ["xiaohongshu-old"]);
  assert.equal(result[0].categoryName, "穿搭");
});

test("source is searchable and rendered from canonical platform values", () => {
  assert.deepEqual(legacyItems.map((entry) => inspirationSourceLabel(entry.platform)), ["抖音", "小红书", "网页"]);
  assert.deepEqual(filterUnifiedInspirations(legacyItems, "全部", "小红书", new Map()).map((entry) => entry.id), ["xiaohongshu-old"]);
});

test("cover rendering prefers cover, then legacy image, then the source fallback", () => {
  const withRealCover = item({ platform: "douyin", cover: "https://cdn.example.test/real.jpg", image: "https://cdn.example.test/legacy.jpg" });
  assert.deepEqual(inspirationCoverCandidates(withRealCover), ["https://cdn.example.test/real.jpg", "https://cdn.example.test/legacy.jpg", "/assets/inspiration-ribbons.png"]);
  const legacyOnly = item({ platform: "xiaohongshu", cover: "", image: "https://cdn.example.test/legacy-xhs.jpg" });
  assert.deepEqual(inspirationCoverCandidates(legacyOnly), ["https://cdn.example.test/legacy-xhs.jpg", "/assets/inspiration-sea.png"]);
  const noCover = item({ platform: "web", cover: "", image: "" });
  assert.deepEqual(inspirationCoverCandidates(noCover), ["/assets/inspiration-ribbons.png"]);
});

test("the desktop inspiration page exposes only the unified Phase 7.2 spaces", () => {
  const source = readFileSync(new URL("../src/pages/InspirationPage.tsx", import.meta.url), "utf8");
  assert.match(source, /id: "收藏灵感"/u);
  assert.match(source, /id: "我的笔记"/u);
  assert.doesNotMatch(source, /抖音灵感|小红书灵感|文字记录/u);
  assert.doesNotMatch(source, /item\.portal|entry\.portal|portal:/u);
});
