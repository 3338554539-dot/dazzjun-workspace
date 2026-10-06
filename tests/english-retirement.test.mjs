import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("desktop Sidebar has no English module entry", async () => {
  const [shell, sidebar] = await Promise.all([read("src/components/Shell.tsx"), read("src/components/workspace/Sidebar.tsx")]);
  assert.doesNotMatch(shell, /label: "英语学习"/);
  assert.doesNotMatch(sidebar, /item\.id === "english"/);
});

test("mobile record and more sheets have no English action", async () => {
  const mobile = await read("src/components/workspace/MobileNavigation.tsx");
  assert.doesNotMatch(mobile, /英语学习|英语打卡|go\("english"\)|onNavigate\("english"/);
  assert.match(mobile, /记录今日心情/);
  assert.match(mobile, /记录昨日心情/);
});

test("Quick Create does not expose English as a standalone module", async () => {
  const overview = await read("src/pages/OverviewPage.tsx");
  assert.doesNotMatch(overview, /page: "english"|英语打卡/);
  assert.match(overview, /page: "learning"/);
});

test("dashboard recent activity and habit UI contain no English module row", async () => {
  const [overview, growth] = await Promise.all([read("src/pages/OverviewPage.tsx"), read("src/components/GrowthDashboard.tsx")]);
  assert.doesNotMatch(overview, /workspace\.english\.map|module: "英语"/);
  assert.doesNotMatch(growth, /id: "english", label: "英语"|English Day/);
});

test("legacy /english bookmark redirects to Learning with a light notice", async () => {
  const app = await read("src/App.tsx");
  assert.match(app, /normalizedPath === "\/english"/);
  assert.match(app, /"\/learning\?retired=english"/);
  assert.match(app, /英语学习已合并到学习日志/);
  assert.doesNotMatch(app, /english: EnglishPage/);
});

test("legacy English payload and parser remain readable", async () => {
  const [types, defaults, store, page] = await Promise.all([
    read("src/data/types.ts"), read("src/data/defaults.ts"), read("src/store/workspaceStore.ts"), read("src/pages/EnglishPage.tsx"),
  ]);
  assert.match(types, /english: EnglishEntry\[\]/);
  assert.match(defaults, /english: Array\.isArray\(input\.english\) \? input\.english : \[\]/);
  assert.match(store, /english:/);
  assert.match(page, /export function EnglishPage/);
});

test("Learning remains routable and accepts English as a normal category end to end", async () => {
  const [app, learning, types, search, backendDefaults, workerBlocks] = await Promise.all([
    read("src/App.tsx"), read("src/pages/LearningPage.tsx"), read("src/data/types.ts"), read("src/services/search.ts"), read("backend/defaults.mjs"), read("worker/learning/blocks.js"),
  ]);
  assert.match(app, /learning: LearningPage/);
  assert.match(learning, /"英语"/);
  assert.match(types, /LearningCategory = [^;]*"英语"/);
  assert.match(search, /data\.english\.map[\s\S]*page: "learning" as const/);
  assert.match(backendDefaults, /\["书籍", "课程", "技能", "文章", "英语"\]/);
  assert.match(workerBlocks, /\["书籍", "课程", "技能", "文章", "英语"\]/);
});
