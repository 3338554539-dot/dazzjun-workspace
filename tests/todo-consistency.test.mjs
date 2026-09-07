import assert from "node:assert/strict";
import test from "node:test";
import { buildAIContext } from "../worker/ai/context.ts";
import { applyTodoPatch, getTodayTasks, getTodoStats, todoTimingFromStart } from "../src/services/todoSelectors.ts";

const today = "2026-08-04";

const task = (id, scheduleDate, done = false, overrides = {}) => ({
  id,
  title: id,
  category: "工作",
  priority: "中",
  scheduleDate,
  startAt: `${scheduleDate}T09:00`,
  deadline: "2026-08-10T18:00",
  done,
  createdAt: `${today}T08:00:00.000Z`,
  ...overrides,
});

test("task creation derives scheduleDate from startAt and keeps deadline independent", () => {
  assert.deepEqual(todoTimingFromStart("2026-08-04T09:00", "2026-08-10T18:00", today), {
    scheduleDate: "2026-08-04",
    startAt: "2026-08-04T09:00",
    deadline: "2026-08-10T18:00",
  });
});

test("editing deadline preserves scheduleDate while editing startAt synchronizes it", () => {
  const original = task("editable", today);
  const deadlineOnly = applyTodoPatch(original, { deadline: "2026-08-12T18:00" });
  const startChanged = applyTodoPatch(deadlineOnly, { startAt: "2026-08-06T10:30" });

  assert.equal(deadlineOnly.scheduleDate, today);
  assert.equal(deadlineOnly.deadline, "2026-08-12T18:00");
  assert.equal(startChanged.scheduleDate, "2026-08-06");
  assert.equal(startChanged.deadline, "2026-08-12T18:00");
});

test("historical and future tasks never enter today's task progress", () => {
  const tasks = [
    task("yesterday-done", "2026-08-03", true, { deadline: `${today}T18:00`, completedAt: `${today}T10:00:00.000Z` }),
    task("tomorrow", "2026-08-05", false, { createdAt: `${today}T08:30:00.000Z` }),
  ];

  assert.deepEqual(getTodayTasks(tasks, today), []);
  assert.deepEqual(getTodoStats(getTodayTasks(tasks, today)), { total: 0, done: 0, pending: 0, progress: 0 });
});

test("two completed tasks out of five scheduled today produce forty percent", () => {
  const tasks = [
    task("today-1", today, true),
    task("today-2", today, true),
    task("today-3", today),
    task("today-4", today),
    task("today-5", today),
    task("history", "2026-08-01", true),
    task("future", "2026-08-09", true),
  ];

  assert.deepEqual(getTodoStats(getTodayTasks(tasks, today)), { total: 5, done: 2, pending: 3, progress: 40 });
});

test("AI Context Builder includes only tasks scheduled for the current Shanghai day", () => {
  const context = JSON.parse(buildAIContext({
    todos: [
      task("history-secret", "2026-08-03", true),
      task("today-visible", today, false),
      task("future-secret", "2026-08-05", false),
    ],
  }, new Date("2026-08-04T04:00:00.000Z")));

  assert.equal(context.today, today);
  assert.equal(context.shortTermContext.counts.todo, 1);
  assert.deepEqual(context.shortTermContext.recent.todo.map((item) => item.title), ["today-visible"]);
  assert.equal(JSON.stringify(context).includes("history-secret"), false);
  assert.equal(JSON.stringify(context).includes("future-secret"), false);
});
