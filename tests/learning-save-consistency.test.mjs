import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeWorkspaceForStorage } from "../backend/defaults.mjs";
import { canSaveLearning, saveLearningEntryConsistently } from "../src/services/learningSave.ts";
import { confirmLearningAssets } from "../worker/learning/assets.js";

const richEntry = {
  id: "learning_consistency_001",
  date: "2026-08-11",
  title: "保存一致性",
  category: "课程",
  duration: 45,
  content: "正文",
  notes: "",
  gain: "",
  learningBlocks: [
    { id: "text-1", type: "text", content: "正文" },
    { id: "asset_image_001", assetId: "asset_image_001", type: "image", url: "/api/learning/assets/asset_image_001", thumbnail: "/api/learning/assets/asset_image_001?variant=thumbnail", name: "学习图.png", size: 100, mime: "image/png", createdAt: "2026-08-11T00:00:00.000Z" },
  ],
};

test("uploaded image is confirmed only after workspace persistence succeeds", async () => {
  const events = [];
  const result = await saveLearningEntryConsistently({
    entry: richEntry,
    addLearning: () => events.push("local"),
    persistWorkspace: async () => { events.push("workspace"); },
    confirmAssets: async (_learningId, assetIds) => { events.push(`attached:${assetIds.join(",")}`); },
  });
  assert.deepEqual(events, ["local", "workspace", "attached:asset_image_001"]);
  assert.deepEqual(result.assetIds, ["asset_image_001"]);
});

test("upload failure keeps save disabled", () => {
  assert.equal(canSaveLearning({ uploading: false, uploadFailed: true, saving: false }), false);
  assert.equal(canSaveLearning({ uploading: true, uploadFailed: false, saving: false }), false);
  assert.equal(canSaveLearning({ uploading: false, uploadFailed: false, saving: false }), true);
});

test("a persisted rich learning entry survives refresh normalization", () => {
  const stored = normalizeWorkspaceForStorage({ learning: [richEntry] });
  const refreshed = normalizeWorkspaceForStorage(JSON.parse(JSON.stringify(stored)));
  assert.equal(refreshed.learning[0].title, "保存一致性");
  assert.equal(refreshed.learning[0].learningBlocks[1].assetId, "asset_image_001");
});

test("workspace failure rejects the save and never confirms assets", async () => {
  let confirmed = false;
  await assert.rejects(() => saveLearningEntryConsistently({
    entry: richEntry,
    addLearning: () => {},
    persistWorkspace: async () => { throw new Error("workspace failed"); },
    confirmAssets: async () => { confirmed = true; },
  }), /workspace failed/u);
  assert.equal(confirmed, false);
});

test("asset status moves from pending to attached only for a referenced user asset", async () => {
  const assets = new Map([["asset_image_001", { userId: "user-a", learningId: richEntry.id, status: "pending" }]]);
  const db = {
    prepare(sql) {
      let values = [];
      return {
        sql,
        bind(...next) { values = next; this.values = values; return this; },
        async first() {
          if (sql.startsWith("SELECT payload_json")) return { payload: JSON.stringify({ learning: [richEntry] }) };
          return null;
        },
      };
    },
    async batch(statements) {
      return statements.map((statement) => {
        const [, id, userId, learningId] = statement.values;
        const asset = assets.get(id);
        const changes = asset?.userId === userId && asset?.learningId === learningId ? 1 : 0;
        if (changes) asset.status = "attached";
        return { meta: { changes } };
      });
    },
  };
  const result = await confirmLearningAssets({ db, userId: "user-a", learningId: richEntry.id, assetIds: ["asset_image_001"] });
  assert.equal(result.assets[0].status, "attached");
  assert.equal(assets.get("asset_image_001").status, "attached");

  const worker = await readFile(new URL("../worker/api.js", import.meta.url), "utf8");
  assert.match(worker, /\/api\/learning\/assets\/confirm[\s\S]*requireUser\(request, db\)/u);
});
