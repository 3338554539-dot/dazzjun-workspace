import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeWorkspaceForStorage } from "../backend/defaults.mjs";
import { handleApiRequest, isApiRoute } from "../worker/api.js";
import { previewLearningLink } from "../worker/learning/link-preview.js";
import { pdfBytes, pngBytes, webpBytes } from "./helpers/learning-files.mjs";

const assets = new Map();
let currentUserId = "user-a";

const db = {
  prepare(sql) {
    let values = [];
    return {
      bind(...next) { values = next; return this; },
      async first() {
        if (sql.includes("FROM sessions s JOIN users")) return { id: currentUserId, email: `${currentUserId}@example.com`, displayName: currentUserId, bio: "", createdAt: "2026-08-11", updatedAt: "2026-08-11" };
        if (sql.includes("FROM learning_assets WHERE id=? AND user_id=?")) {
          const asset = assets.get(values[0]);
          return asset?.userId === values[1] ? asset : null;
        }
        return null;
      },
      async run() {
        if (sql.startsWith("INSERT INTO learning_assets")) {
          const [id, userId, learningId, blockType, objectKey, thumbnailKey, name, size, mime, createdAt] = values;
          assets.set(id, { id, userId, learningId, blockType, objectKey, thumbnailKey, name, size, mime, createdAt });
        }
        if (sql.startsWith("DELETE FROM learning_assets")) {
          const asset = assets.get(values[0]);
          if (asset?.userId === values[1]) assets.delete(values[0]);
        }
        return { meta: { changes: 1 } };
      },
    };
  },
};

const objects = new Map();
const bucket = {
  async put(key, value, options) {
    objects.set(key, { bytes: new Uint8Array(await new Response(value).arrayBuffer()), options });
  },
  async get(key) {
    const object = objects.get(key);
    if (!object) return null;
    return { body: new Blob([object.bytes]).stream(), size: object.bytes.length, httpEtag: `"${key}"`, httpMetadata: object.options.httpMetadata };
  },
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); },
};

const env = { DB: db, LEARNING_ASSETS: bucket };
const apiRequest = (path, options = {}) => new Request(`https://dazzjun.example${path}`, { ...options, headers: { cookie: "dazzjun_session=test", ...(options.body ? { origin: "https://dazzjun.example" } : {}), ...options.headers } });

test("legacy learning entries remain readable and rich blocks survive refresh normalization", () => {
  const legacy = normalizeWorkspaceForStorage({ learning: [{ id: "old", date: "2026-08-10", title: "旧记录", category: "文章", learningContent: "旧正文", learningNote: "旧笔记", reflection: "旧收获", duration: 30 }], todos: [], memories: [] });
  assert.equal(legacy.learning[0].content, "旧正文");
  assert.equal(legacy.learning[0].notes, "旧笔记");
  assert.equal(legacy.learning[0].gain, "旧收获");
  const rich = normalizeWorkspaceForStorage({ learning: [{ id: "new", date: "2026-08-11", title: "新记录", category: "课程", content: "正文", notes: "", gain: "", duration: 45, learningBlocks: [{ id: "text-1", type: "text", content: "正文" }, { id: "link-1", type: "link", url: "https://openai.com/", title: "OpenAI", favicon: "", siteName: "OpenAI", description: "学习资料" }] }], todos: [], memories: [] });
  assert.deepEqual(rich.learning[0].learningBlocks.map((block) => block.type), ["text", "link"]);
});

test("authenticated image and PDF uploads use private user-scoped asset routes", async () => {
  assets.clear(); objects.clear(); currentUserId = "user-a";
  const imageForm = new FormData();
  imageForm.set("learning_id", "learning_001");
  imageForm.set("file", new Blob([pngBytes()], { type: "image/png" }), "diagram.png");
  imageForm.set("thumbnail", new Blob([webpBytes()], { type: "image/webp" }), "thumb.webp");
  const imageResponse = await handleApiRequest(apiRequest("/api/learning/assets", { method: "POST", body: imageForm }), env);
  assert.equal(imageResponse.status, 201);
  const image = (await imageResponse.json()).block;
  assert.equal(image.type, "image");
  assert.match(image.thumbnail, /^\/api\/learning\/assets\/.+variant=thumbnail$/u);
  assert.ok([...objects.keys()].every((key) => key.startsWith("users/user-a/learning/learning_001/")));

  const pdfForm = new FormData();
  pdfForm.set("learning_id", "learning_001");
  pdfForm.set("file", new Blob([pdfBytes()], { type: "application/pdf" }), "学习资料.pdf");
  const pdfResponse = await handleApiRequest(apiRequest("/api/learning/assets", { method: "POST", body: pdfForm }), env);
  const pdf = (await pdfResponse.json()).block;
  assert.equal(pdf.type, "file");
  assert.equal(pdf.name, "学习资料.pdf");

  const ownerRead = await handleApiRequest(apiRequest(image.url), env);
  assert.equal(ownerRead.status, 200);
  currentUserId = "user-b";
  const previousConsoleError = console.error;
  console.error = () => {};
  const crossAccountRead = await handleApiRequest(apiRequest(image.url), env).finally(() => { console.error = previousConsoleError; });
  assert.equal(crossAccountRead.status, 404);
});

test("link preview builds a safe metadata card", async () => {
  const block = await previewLearningLink("https://docs.example.com/guide", async () => new Response('<html><head><title>AI 学习指南</title><meta name="description" content="个人知识库资料"><link rel="icon" href="/icon.png"></head></html>', { headers: { "content-type": "text/html" } }));
  assert.equal(block.type, "link");
  assert.equal(block.title, "AI 学习指南");
  assert.equal(block.description, "个人知识库资料");
  assert.equal(block.favicon, "https://docs.example.com/icon.png");
});

test("worker routes and mobile styles include rich learning media", async () => {
  assert.equal(isApiRoute("/api/learning/assets"), true);
  assert.equal(isApiRoute("/api/learning/assets/asset-1"), true);
  assert.equal(isApiRoute("/api/learning/link-preview"), true);
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.learning-editor/u);
  assert.match(css, /\.learning-file-card/u);
  assert.match(css, /\.learning-lightbox/u);
});
