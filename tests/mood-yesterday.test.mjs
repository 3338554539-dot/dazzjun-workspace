import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("mood editor defaults selectedDate to the user's local today", async () => {
  const page = await read("src/pages/MoodPage.tsx");
  assert.match(page, /const initialDate = recordDate \?\? params\.get\("date"\) \?\? today/);
  assert.match(page, /useState\(initialDate\)/);
});

test("yesterday entry switches selectedDate to local yesterday", async () => {
  const [page, date] = await Promise.all([read("src/pages/MoodPage.tsx"), read("src/services/date.ts")]);
  assert.match(page, /onClick=\{\(\) => selectDate\(yesterday\)\}/);
  assert.match(date, /export function yesterdayISO\(today = todayISO\(\)\)/);
  assert.doesNotMatch(date, /toISOString\(\)\.slice\(0,\s*10\)/);
});

test("missing yesterday record produces a new draft", async () => {
  const page = await read("src/pages/MoodPage.tsx");
  assert.match(page, /draftFromEntry\(entries\.find\(\(entry\) => entry\.date === date\)\)/);
  assert.match(page, /entry\?\.mood \?\? "平静"/);
});

test("existing yesterday record is loaded and updated instead of duplicated", async () => {
  const [page, store] = await Promise.all([read("src/pages/MoodPage.tsx"), read("src/store/workspaceStore.ts")]);
  assert.match(page, /entries\.find\(\(entry\) => entry\.date === selectedDate\)/);
  assert.match(page, /已有记录，保存后更新原内容/);
  assert.match(store, /state\.moods\.find\(\(mood\) => mood\.date === entry\.date\)/);
});

test("saving a backfilled mood uses selectedDate as its record date", async () => {
  const page = await read("src/pages/MoodPage.tsx");
  assert.match(page, /upsertMood\(\{ date: selectedDate,/);
  assert.match(page, /保存昨日记录/);
});

test("createdAt records the real creation timestamp while record date remains separate", async () => {
  const [types, store] = await Promise.all([read("src/data/types.ts"), read("src/store/workspaceStore.ts")]);
  assert.match(types, /interface MoodEntry[\s\S]*date: string;[\s\S]*createdAt\?: string;[\s\S]*updatedAt: string;/);
  assert.match(store, /createdAt: existing\?\.createdAt \?\? timestamp/);
  assert.match(store, /updatedAt: timestamp/);
});

test("today status only reads a mood whose record date is today", async () => {
  const growth = await read("src/services/growthModules.ts");
  assert.match(growth, /today: entries\.find\(\(entry\) => entry\.date === today\)/);
});

test("seven-day trend assigns backfilled mood to its record date", async () => {
  const [growth, rail] = await Promise.all([read("src/services/growthModules.ts"), read("src/components/workspace/ContextRail.tsx")]);
  assert.match(growth, /entries\.filter\(\(entry\) => sevenDays\.has\(entry\.date\)\)/);
  assert.match(rail, /moods\.find\(\(entry\) => entry\.date === iso\)\?\.score/);
});

test("timeline sorts and groups entries by record date", async () => {
  const page = await read("src/pages/MoodPage.tsx");
  assert.match(page, /sort\(\(a, b\) => b\.date\.localeCompare\(a\.date\)\)/);
  assert.match(page, /timelinePeriod\(entry\.date, today\)/);
  assert.match(page, /onClick=\{\(\) => selectDate\(entry\.date\)\}/);
});

test("AI handoff explicitly identifies the selected mood record date", async () => {
  const page = await read("src/pages/MoodPage.tsx");
  assert.match(page, /这是 \$\{selectedDate\} 的心情记录，不一定是今天/);
  assert.match(page, /navigate\("ai", \{ prompt, send: "1" \}\)/);
});

test("switching dates preserves each unsaved mood draft", async () => {
  const page = await read("src/pages/MoodPage.tsx");
  assert.match(page, /useState<Record<string, MoodDraft>>/);
  assert.match(page, /\[selectedDate\]: draft, \[date\]: current\[date\] \?\? draftFromEntry/);
  assert.match(page, /未保存草稿已保留/);
});

test("390px mood controls wrap without horizontal overflow", async () => {
  const css = await read("src/workspace-v9.css");
  assert.match(css, /body \{ overflow-x: hidden/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*?\.mood-date-switch/);
  assert.match(css, /\.mood-editor-actions[\s\S]*?flex-wrap: wrap/);
});
