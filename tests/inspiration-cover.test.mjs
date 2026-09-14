import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { captureInspiration, selectInspirationCover } from "../worker/inspiration/capture.js";
import { dailyInspirationResponse } from "../worker/inspiration/daily.js";
import { needsInspirationCoverRefresh } from "../src/services/inspirationLibrary.ts";

const response = (html) => new Response(html, { status: 200, headers: { "content-type": "text/html" } });

test("Douyin share text follows the short link and records a real video poster candidate", async () => {
  const result = await captureInspiration({
    sourceText: "7.94 TlC:/ 视频标题 https://v.douyin.com/cover-test/ 复制此链接，打开Dou音搜索，直接观看视频！",
    fetchImpl: async (url) => url.includes("v.douyin.com")
      ? new Response(null, { status: 302, headers: { location: "https://www.douyin.com/video/123" } })
      : response('<meta property="og:image" content="https://cdn.test/og.jpg"><script>{"video":{"originCover":{"url_list":["https://cdn.test/poster.jpg"]}}}</script>'),
  });
  assert.equal(result.cover, "https://cdn.test/poster.jpg");
  assert.equal(result.coverType, "video_poster");
  assert.notEqual(result.coverType, "video_first_frame");
});

test("Xiaohongshu video uses its poster and never labels it as a decoded first frame", async () => {
  const result = await captureInspiration({
    url: "https://www.xiaohongshu.com/discovery/item/video-note",
    fetchImpl: async () => response('<script>{"type":"video","videoPoster":"https://sns.test/video-poster.webp"}</script><meta property="og:image" content="https://sns.test/og.webp">'),
  });
  assert.equal(result.cover, "https://sns.test/video-poster.webp");
  assert.equal(result.coverType, "video_poster");
});

test("only an explicit video first-frame field is labelled as a first frame", async () => {
  const result = await captureInspiration({
    url: "https://www.xiaohongshu.com/discovery/item/video-first-frame",
    fetchImpl: async () => response('<script>{"type":"video","firstFrame":"https://sns.test/first-frame.webp","videoPoster":"https://sns.test/poster.webp"}</script>'),
  });
  assert.equal(result.cover, "https://sns.test/first-frame.webp");
  assert.equal(result.coverType, "video_first_frame");
});

test("Xiaohongshu image notes prefer the first content image over Open Graph", async () => {
  const result = await captureInspiration({
    url: "https://www.xiaohongshu.com/discovery/item/image-note",
    fetchImpl: async () => response('<meta property="og:image" content="https://sns.test/og.webp"><script>{"type":"normal","imageList":[{"urlDefault":"https://sns.test/content-first.webp"},{"urlDefault":"https://sns.test/content-second.webp"}]}</script>'),
  });
  assert.equal(result.cover, "https://sns.test/content-first.webp");
  assert.equal(result.coverType, "first_image");
});

test("ordinary webpages prefer a valid Open Graph content image", async () => {
  const result = await captureInspiration({
    url: "https://article.test/read",
    fetchImpl: async () => response('<meta property="og:image" content="/story/hero.jpg"><article><img src="/story/body.jpg" width="900" height="600"></article>'),
  });
  assert.equal(result.cover, "https://article.test/story/hero.jpg");
  assert.equal(result.coverType, "og_image");
});

test("platform logos cannot override a content image", async () => {
  const result = await captureInspiration({
    url: "https://article.test/read",
    fetchImpl: async () => response('<meta property="og:image" content="/assets/site-logo.png"><main><img class="article-hero" src="/story/real-content.jpg" width="1200" height="800"></main>'),
  });
  assert.equal(result.cover, "https://article.test/story/real-content.jpg");
  assert.equal(result.coverType, "main_image");
});

test("the Dazzjun default is used only after every real candidate fails", async () => {
  const selected = selectInspirationCover({ platform: "web", contentType: "image", firstImages: [], ogImages: ["https://article.test/favicon.png"], mainImages: [] });
  assert.deepEqual(selected, {
    cover: "/assets/inspiration-ribbons.png",
    coverSource: "/assets/inspiration-ribbons.png",
    coverType: "fallback",
  });
});

test("a short-link landing page Open Graph default is never treated as the content cover", async () => {
  const result = await captureInspiration({
    url: "https://v.douyin.com/not-redirected/",
    fetchImpl: async () => response('<meta property="og:image" content="https://static.test/douyin-default-share.jpg">'),
  });
  assert.equal(result.coverType, "fallback");
  assert.equal(result.cover, "/assets/inspiration-ribbons.png");
});

test("legacy default covers expose the reparse action while real covers do not", () => {
  assert.equal(needsInspirationCoverRefresh({ cover: "/assets/inspiration-ribbons.png" }), true);
  assert.equal(needsInspirationCoverRefresh({ cover: "https://cdn.test/real.jpg", coverType: "og_image" }), false);
  const page = readFileSync(new URL("../src/pages/InspirationPage.tsx", import.meta.url), "utf8");
  assert.match(page, /重新解析封面/u);
  assert.match(page, /updateInspiration\(item\.id/u);
});

test("homepage daily inspiration returns the same updated cover field", () => {
  const result = dailyInspirationResponse({ id: "user-a:item", title: "真实封面", cover: "https://cdn.test/updated.jpg", image: "/assets/inspiration-ribbons.png", platform: "web" }, "user-a");
  assert.equal(result.cover, "https://cdn.test/updated.jpg");
});

test("random inspiration remains isolated by the authenticated user query", () => {
  const api = readFileSync(new URL("../worker/api.js", import.meta.url), "utf8");
  assert.match(api, /SELECT COUNT\(\*\) AS count FROM inspirations WHERE user_id=\?/u);
  assert.match(api, /FROM inspirations WHERE user_id=\? ORDER BY/u);
  assert.match(api, /const \{ user \} = await requireUser\(request, db\)/u);
});
