import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWorkspaceData } from "../src/data/defaults.ts";
import { getTodayTasks } from "../src/services/todoSelectors.ts";

test("legacy todo dates migrate to scheduleDate and deadline", () => {
  const workspace = normalizeWorkspaceData({
    todos: [{
      id: "legacy-todo",
      title: "旧任务",
      category: "工作",
      priority: "高",
      startAt: "2026-07-31T09:00",
      dueAt: "2026-08-01T18:00",
      done: false,
      createdAt: "2026-07-30T08:00:00.000Z",
    }],
  });

  assert.equal(workspace.todos[0].scheduleDate, "2026-07-31");
  assert.equal(workspace.todos[0].deadline, "2026-08-01T18:00");
  assert.equal("dueAt" in workspace.todos[0], false);
});

test("today plan uses scheduleDate instead of deadline", () => {
  const today = "2026-07-31";
  const todos = normalizeWorkspaceData({
    todos: [
      {
        id: "scheduled-today",
        title: "今天执行，明天截止",
        category: "学习",
        priority: "中",
        scheduleDate: today,
        startAt: `${today}T09:00`,
        deadline: "2026-08-01T18:00",
        done: false,
        createdAt: "2026-07-31T08:00:00.000Z",
      },
      {
        id: "due-today",
        title: "明天执行，今天截止",
        category: "生活",
        priority: "低",
        scheduleDate: "2026-08-01",
        startAt: "2026-08-01T09:00",
        deadline: `${today}T18:00`,
        done: false,
        createdAt: "2026-07-31T08:00:00.000Z",
      },
    ],
  }).todos;

  assert.deepEqual(getTodayTasks(todos, today).map((item) => item.id), ["scheduled-today"]);
});

test("today progress ignores every completed task scheduled on historical dates", () => {
  const today = "2026-08-04";
  const makeTodo = (id, scheduleDate, done) => ({
    id,
    title: id,
    category: "工作",
    priority: "中",
    scheduleDate,
    startAt: `${scheduleDate}T09:00`,
    deadline: `${today}T18:00`,
    done,
    createdAt: `${today}T08:00:00.000Z`,
    completedAt: done ? `${today}T10:00:00.000Z` : undefined,
  });
  const todos = [
    makeTodo("history-08-01", "2026-08-01", true),
    makeTodo("history-08-02", "2026-08-02", true),
    makeTodo("history-08-03", "2026-08-03", true),
    makeTodo("today-done", today, true),
    makeTodo("today-pending", today, false),
  ];

  const todayTasks = getTodayTasks(todos, today);
  const done = todayTasks.filter((item) => item.done).length;
  const todayStats = {
    total: todayTasks.length,
    done,
    pending: todayTasks.length - done,
    progress: todayTasks.length ? Math.round(done / todayTasks.length * 100) : 0,
  };

  assert.deepEqual(getTodayTasks(todos, today).map((item) => item.id), ["today-done", "today-pending"]);
  assert.deepEqual(todayStats, { total: 2, done: 1, pending: 1, progress: 50 });
});
