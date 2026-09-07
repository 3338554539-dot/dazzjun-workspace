import type { TodoItem } from "../data/types";

export function getTodayTasks(tasks: TodoItem[], today: string) {
  return tasks.filter((task) => task.scheduleDate === today);
}

export function getTodoStats(tasks: TodoItem[]) {
  const done = tasks.filter((task) => task.done).length;
  return {
    total: tasks.length,
    done,
    pending: tasks.length - done,
    progress: tasks.length ? Math.round(done / tasks.length * 100) : 0,
  };
}

export function todoTimingFromStart(startAt: string, deadline: string, fallbackDate: string) {
  return {
    scheduleDate: startAt.slice(0, 10) || fallbackDate,
    startAt,
    deadline,
  };
}

export function syncScheduleDateFromStart(patch: Partial<TodoItem>) {
  if (typeof patch.startAt !== "string") return patch;
  const scheduleDate = patch.startAt.slice(0, 10);
  return scheduleDate ? { ...patch, scheduleDate } : patch;
}

export function applyTodoPatch(todo: TodoItem, patch: Partial<TodoItem>): TodoItem {
  return { ...todo, ...syncScheduleDateFromStart(patch) };
}
