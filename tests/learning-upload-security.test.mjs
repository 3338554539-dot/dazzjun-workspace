import assert from "node:assert/strict";
import test from "node:test";
import { handleApiRequest } from "../worker/api.js";
import { learningAssetLimits, validateLearningFile } from "../worker/learning/file-security.js";
import { jpegBytes, pdfBytes, pngBytes, storedZip, webpBytes } from "./helpers/learning-files.mjs";

const assets = new Map();
const objects = new Map();
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

const bucket = {
  async put(key, value, options) { objects.set(key, { bytes: new Uint8Array(await new Response(value).arrayBuffer()), options }); },
  async get(key) {
    const object = objects.get(key);
    return object ? { body: new Blob([object.bytes]).stream(), size: object.bytes.length, httpEtag: `"${key}"`, httpMetadata: object.options.httpMetadata } : null;
  },
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); },
};

const env = { DB: db, LEARNING_ASSETS: bucket };
const apiRequest = (path, options = {}) => new Request(`https://dazzjun.example${path}`, { ...options, headers: { cookie: "dazzjun_session=test", ...(options.body ? { origin: "https://dazzjun.example" } : {}), ...options.headers } });
const uploadRequest = (name, mime, bytes) => {
  const form = new FormData();
  form.set("learning_id", "learning_security_001");
  form.set("file", new Blob([bytes], { type: mime }), name);
  return apiRequest("/api/learning/assets", { method: "POST", body: form });
};
const quietApi = async (request) => {
  const previous = console.error;
  console.error = () => {};
  try { return await handleApiRequest(request, env); } finally { console.error = previous; }
};

test.beforeEach(() => { assets.clear(); objects.clear(); currentUserId = "user-a"; });

test("accepts a valid PNG and stores it under the normalized private key", async () => {
  const response = await handleApiRequest(uploadRequest("diagram.png", "image/png", pngBytes()), env);
  assert.equal(response.status, 201);
  const block = (await response.json()).block;
  assert.equal(block.type, "image");
  const key = [...objects.keys()][0];
  assert.match(key, /^users\/user-a\/learning\/learning_security_001\/[0-9a-f-]+\/original$/u);
});

test("accepts a valid PDF", async () => {
  const response = await handleApiRequest(uploadRequest("notes.pdf", "application/pdf", pdfBytes()), env);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).block.mime, "application/pdf");
});

test("accepts JPEG and WEBP signatures with matching MIME declarations", () => {
  assert.equal(validateLearningFile({ name: "photo.jpeg", mime: "image/jpeg", bytes: jpegBytes() }).blockType, "image");
  assert.equal(validateLearningFile({ name: "cover.webp", mime: "image/webp", bytes: webpBytes() }).blockType, "image");
});

test("rejects PNG content disguised as PDF", async () => {
  const response = await quietApi(uploadRequest("fake.pdf", "application/pdf", pngBytes()));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "文件内容与类型不匹配");
  assert.equal(objects.size, 0);
});

test("rejects PDF content disguised as PNG", async () => {
  const response = await quietApi(uploadRequest("fake.png", "image/png", pdfBytes()));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "文件内容与类型不匹配");
});

test("rejects damaged ZIP archives", async () => {
  const response = await quietApi(uploadRequest("broken.zip", "application/zip", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "文件内容与类型不匹配");
});

test("rejects unsupported extensions and octet-stream", async () => {
  const extensionResponse = await quietApi(uploadRequest("payload.exe", "application/octet-stream", pngBytes()));
  assert.equal(extensionResponse.status, 422);
  assert.equal((await extensionResponse.json()).error, "文件格式不支持");
  const mimeResponse = await quietApi(uploadRequest("diagram.png", "application/octet-stream", pngBytes()));
  assert.equal(mimeResponse.status, 422);
  assert.equal((await mimeResponse.json()).error, "文件格式不支持");
});

test("rejects empty files", async () => {
  const response = await quietApi(uploadRequest("empty.pdf", "application/pdf", new Uint8Array()));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "文件不能为空");
});

test("rejects files over 25MB before content inspection", () => {
  assert.throws(() => validateLearningFile({ name: "large.pdf", mime: "application/pdf", bytes: pdfBytes(), size: learningAssetLimits.maxFileBytes + 1 }), /附件超过 25MB 限制/u);
});

test("requires Office ZIP containers to contain Content_Types", () => {
  const office = [
    ["notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "word/document.xml"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xl/workbook.xml"],
    ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "ppt/presentation.xml"],
  ];
  for (const [name, mime, entry] of office) assert.doesNotThrow(() => validateLearningFile({ name, mime, bytes: storedZip(["[Content_Types].xml", entry]) }));
  assert.throws(() => validateLearningFile({ name: "fake.docx", mime: office[0][1], bytes: storedZip(["ordinary.txt"]) }), /文件内容与类型不匹配/u);
  assert.throws(() => validateLearningFile({ name: "renamed.docx", mime: office[0][1], bytes: storedZip(["[Content_Types].xml", "xl/workbook.xml"]) }), /文件内容与类型不匹配/u);
});

test("accepts a structurally valid ZIP archive", async () => {
  const response = await handleApiRequest(uploadRequest("resources.zip", "application/zip", storedZip(["notes.txt"])), env);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).block.mime, "application/zip");
});

test("cross-account read and delete cannot access another user's file", async () => {
  const upload = await handleApiRequest(uploadRequest("private.pdf", "application/pdf", pdfBytes()), env);
  const block = (await upload.json()).block;
  const originalKeys = [...objects.keys()];
  currentUserId = "user-b";
  const read = await quietApi(apiRequest(block.url));
  assert.equal(read.status, 404);
  const remove = await quietApi(apiRequest(block.url, { method: "DELETE" }));
  assert.equal(remove.status, 404);
  assert.equal(assets.size, 1);
  assert.deepEqual([...objects.keys()], originalKeys);
});
