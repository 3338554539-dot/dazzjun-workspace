import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("dashboard metrics pass actionable module context", async () => {
  const page = await read("src/pages/OverviewPage.tsx");
  assert.match(page, /label: "今日任务"[\s\S]*page: "todo"[\s\S]*filter: "today"/);
  assert.match(page, /label: "本周学习"[\s\S]*page: "learning"[\s\S]*filter: "week"/);
  assert.match(page, /stats\.moodToday \? \{ recordId:[\s\S]*: \{ mode: "new"/);
  assert.match(page, /label: "本周运动"[\s\S]*page: "fitness"[\s\S]*filter: "week"/);
  assert.match(page, /label: "本周复盘"[\s\S]*week: stats\.currentWeek\.weekKey/);
});

test("recent records and weekly focus navigate to exact records", async () => {
  const page = await read("src/pages/OverviewPage.tsx");
  for (const module of ["learning", "mood", "fitness", "inspiration", "english"]) assert.match(page, new RegExp(`page: "${module}" as const`));
  assert.match(page, /navigate\(item\.page, item\.options\)/);
  assert.match(page, /navigate\("todo", \{ filter: "week", taskId: item\.id \}\)/);
});

test("quick capture and AI bridge carry creation content", async () => {
  const page = await read("src/pages/OverviewPage.tsx");
  assert.match(page, /page: "inspiration", options: \{ mode: "capture" \}/);
  assert.match(page, /navigate\("ai", clean \? \{ prompt: clean, send: "1" \}/);
  assert.match(page, /QUICK CREATE/);
});

test("target pages consume navigation filters, record ids and create modes", async () => {
  const [todo, mood, learning, english, fitness, inspiration, weekly, ai] = await Promise.all([
    read("src/pages/TodoPage.tsx"), read("src/pages/MoodPage.tsx"), read("src/pages/LearningPage.tsx"), read("src/pages/EnglishPage.tsx"),
    read("src/pages/FitnessPage.tsx"), read("src/pages/InspirationPage.tsx"), read("src/pages/WeeklyPage.tsx"), read("src/pages/AIWorkspacePage.tsx"),
  ]);
  assert.match(todo, /params\.get\("taskId"\)/); assert.match(todo, /params\.get\("date"\)/); assert.match(todo, /data-task-id/);
  assert.match(mood, /params\.get\("recordId"\)/); assert.match(mood, /params\.get\("mode"\) === "new"/);
  assert.match(learning, /params\.get\("recordId"\)/); assert.match(learning, /requestedFilter/);
  assert.match(english, /params\.get\("recordId"\)/); assert.match(fitness, /params\.get\("filter"\) === "week"/);
  assert.match(inspiration, /params\.get\("mode"\) === "capture"/); assert.match(weekly, /params\.get\("week"\)/);
  assert.match(ai, /incomingPrompt/); assert.match(ai, /sendMessage\(incomingPrompt\)/);
});

test("account entry is singular and works from expanded, collapsed and mobile navigation", async () => {
  const [shell, sidebar, command, mobile] = await Promise.all([
    read("src/components/Shell.tsx"), read("src/components/workspace/Sidebar.tsx"), read("src/components/workspace/CommandBar.tsx"), read("src/components/workspace/MobileNavigation.tsx"),
  ]);
  assert.match(shell, /setIdentityOpen\(\(value\) => !value\)/);
  assert.match(shell, /closeOnOutsideClick/);
  assert.match(sidebar, /title=\{collapsed \? "个人账户"/);
  assert.doesNotMatch(command, /os-command-avatar|onAccount|displayName/);
  assert.match(mobile, /os-mobile-account/); assert.match(mobile, /个人账户/);
});

test("context rail exposes calendar, exact today task and inspiration actions", async () => {
  const rail = await read("src/components/workspace/ContextRail.tsx");
  assert.match(rail, /onSelect\(.*String\(day\)/s);
  assert.match(rail, /filter: "today", taskId: task\.id/);
  assert.match(rail, /mode: "capture"/);
});

test("390px dashboard uses a compact two-column status grid without horizontal overflow", async () => {
  const css = await read("src/workspace-v9.css");
  assert.match(css, /body \{ overflow-x: hidden/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.os-metric-grid \{ grid-template-columns: 1fr 1fr;/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*?\.os-metric-card \{ min-height: 92px/);
});
