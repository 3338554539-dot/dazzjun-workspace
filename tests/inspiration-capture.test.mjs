import assert from "node:assert/strict";
import test from "node:test";
import { captureInspiration, detectCapturePlatform, normalizeCaptureUrl } from "../worker/inspiration/capture.js";
import { dailyInspirationOffset, dailyInspirationResponse } from "../worker/inspiration/daily.js";

const douyinShare = "7.94 TlC:/ 05/13 d@n.DU :6pm 军师系列｜漂亮不是被爱的持续必要条件 # 军师系列 # 情感军师 https://v.douyin.com/_C95sosxhsA/\n复制此链接，打开Dou音搜索，直接观看视频！";
const xiaohongshuShare = "33 【啊啊啊啊啊女神你是一颗青苹果🍏 - 安宥真_AnYuJin0901 | 小红书 - 你的生活兴趣社区】\n😆 cvmTmC6k9ZO76DZ 😆\nhttps://www.xiaohongshu.com/discovery/item/6a6d800a000000003400dd51";

function metadataPage({ title = "", image = "", author = "" } = {}) {
  return async () => new Response([
    title && `<meta property="og:title" content="${title}">`,
    image && `<meta property="og:image" content="${image}">`,
    author && `<meta name="author" content="${author}">`,
  ].filter(Boolean).join(""), { status: 200, headers: { "content-type": "text/html" } });
}

test("follows a Douyin short link and prefers the real video cover from page JSON", async () => {
  const fetchImpl = async (url) => {
    if (url === "https://v.douyin.com/_C95sosxhsA/") return new Response(null, { status: 302, headers: { location: "https://www.douyin.com/video/7520000000000000000" } });
    return new Response(`
      <meta property="og:image" content="https://cdn.example.test/douyin-og.jpg">
      <meta name="twitter:image" content="https://cdn.example.test/douyin-twitter.jpg">
      <script>window.__DATA__={"awemeDetail":{"video":{"originCover":{"url_list":["https:\\/\\/p3-sign.douyinpic.com\\/real-cover.jpeg?x=1"]},"cover":{"url_list":["https://cdn.example.test/cover.jpg"]}}}}</script>
    `, { status: 200, headers: { "content-type": "text/html" } });
  };
  const result = await captureInspiration({ sourceText: douyinShare, fetchImpl });

  assert.equal(result.platform, "douyin");
  assert.equal(result.url, "https://www.douyin.com/video/7520000000000000000");
  assert.equal(result.title, "漂亮不是被爱的持续必要条件");
  assert.deepEqual(result.tags, ["军师系列", "情感军师"]);
  assert.equal(result.cover, "https://p3-sign.douyinpic.com/real-cover.jpeg?x=1");
  assert.equal(result.coverType, "video_poster");
  assert.equal(result.coverSource, result.cover);
  assert.notEqual(result.cover.startsWith("/assets/"), true);
});

test("prefers Xiaohongshu imageList.urlDefault over Open Graph fallbacks", async () => {
  const fetchImpl = async () => new Response(`
    <meta property="og:image" content="https://cdn.example.test/xhs-og.jpg">
    <meta name="twitter:image" content="https://cdn.example.test/xhs-twitter.jpg">
    <script>window.__INITIAL_STATE__={"noteDetail":{"note":{"imageList":[{"urlDefault":"https://sns-img-qc.xhscdn.com/real-note.webp?imageView2=2"}]}}}</script>
  `, { status: 200, headers: { "content-type": "text/html" } });
  const result = await captureInspiration({ sourceText: xiaohongshuShare, fetchImpl });

  assert.equal(result.platform, "xiaohongshu");
  assert.equal(result.url, "https://www.xiaohongshu.com/discovery/item/6a6d800a000000003400dd51");
  assert.equal(result.title, "啊啊啊啊啊女神你是一颗青苹果🍏");
  assert.equal(result.author, "安宥真_AnYuJin0901");
  assert.equal(result.cover, "https://sns-img-qc.xhscdn.com/real-note.webp?imageView2=2");
  assert.equal(result.coverType, "first_image");
  assert.equal(result.coverSource, result.cover);
  assert.notEqual(result.cover.startsWith("/assets/"), true);
});

test("normalizes bare URLs and captures ordinary webpages", async () => {
  assert.equal(normalizeCaptureUrl("v.douyin.com/xxxx"), "https://v.douyin.com/xxxx");
  assert.equal(detectCapturePlatform("https://www.iesdouyin.com/share/video/123"), "douyin");
  assert.equal(normalizeCaptureUrl("收藏这个网页 example.com/article"), "https://example.com/article");
  const result = await captureInspiration({ url: "www.example.com/article", fetchImpl: metadataPage({ title: "A page", image: "/cover.png", author: "Dazzjun" }) });
  assert.deepEqual(result, {
    platform: "web",
    title: "A page",
    cover: "https://www.example.com/cover.png",
    coverSource: "https://www.example.com/cover.png",
    coverType: "og_image",
    author: "Dazzjun",
    tags: [],
    url: "https://www.example.com/article",
  });
});

test("does not fetch private hosts while extracting share URLs", async () => {
  await assert.rejects(() => captureInspiration({ sourceText: "http://127.0.0.1:8788/private" }), /没有识别到可用链接/);
  await assert.rejects(() => captureInspiration({ sourceText: "http://[::1]/private" }), /没有识别到可用链接/);
});

test("keeps the daily inspiration selection stable and maps existing rows", () => {
  const first = dailyInspirationOffset("user-a", "2026-08-01", 7);
  assert.equal(first, dailyInspirationOffset("user-a", "2026-08-01", 7));
  assert.equal(first >= 0 && first < 7, true);
  assert.equal(dailyInspirationOffset("user-a", "2026-08-01", 0), -1);
  assert.deepEqual(dailyInspirationResponse({
    id: "user-a:item-1",
    title: "镜头节奏",
    cover: "https://cdn.example.test/cover.jpg",
    image: "https://cdn.example.test/legacy.jpg",
    categoryName: "设计",
    author: "创作者 A",
    platform: "douyin",
    url: "https://www.douyin.com/video/1",
    aiTags: '["镜头","节奏"]',
  }, "user-a"), {
    id: "item-1",
    title: "镜头节奏",
    cover: "https://cdn.example.test/cover.jpg",
    image: "https://cdn.example.test/legacy.jpg",
    platform: "douyin",
    category_name: "设计",
    source: "创作者 A",
    ai_tags: ["镜头", "节奏"],
  });
  assert.equal(dailyInspirationResponse({
    id: "legacy-placeholder",
    title: "旧灵感",
    cover: "/assets/inspiration-ribbons.png",
    image: "/assets/inspiration-ribbons.png",
    platform: "douyin",
  }, "user-a").cover, "/assets/inspiration-ribbons.png");
});
