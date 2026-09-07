import type { TodoItem, WorkspaceData } from "../data/types";
import { defaultWorkspaceData } from "../data/defaults";
import { todayISO } from "./date";

type LegacyTodo = { id: string; title: string; done: boolean; tag?: string; duration?: string };

const seedIds = {
  todos: new Set(["default-plan", "default-read", "design", "words", "training"]),
  moods: new Set(["mood-1", "mood-2", "mood-3", "mood-4", "mood-5", "mood-6"]),
  learning: new Set(["learning-1", "learning-2", "learning-3"]),
  fitness: new Set(["fitness-1", "fitness-2", "fitness-3"]),
  inspirations: new Set(["ins-1", "ins-2", "ins-3", "ins-4", "ins-5", "ins-6"]),
  notes: new Set(["note-1", "note-2", "note-3"]),
  memories: new Set(["memory-style", "memory-learning", "memory-fitness"]),
};

function safeRead<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function createInitialWorkspace(): WorkspaceData {
  const legacyTodos = safeRead<LegacyTodo[]>("dazzjun.todos");
  if (!legacyTodos?.length) return defaultWorkspaceData;
  const today = todayISO();
  const migrated: TodoItem[] = legacyTodos.filter((todo) => !seedIds.todos.has(todo.id)).map((todo, index) => ({
    id: todo.id,
    title: todo.title,
    category: todo.tag === "工作" ? "工作" : todo.tag === "学习" ? "学习" : "生活",
    priority: index < 2 ? "高" : "中",
    scheduleDate: today,
    startAt: `${today}T${String(9 + index).padStart(2, "0")}:00`,
    deadline: `${today}T${String(10 + index).padStart(2, "0")}:00`,
    done: todo.done,
    createdAt: new Date().toISOString(),
    completedAt: todo.done ? new Date().toISOString() : undefined,
  }));
  return { ...defaultWorkspaceData, todos: migrated };
}

export function removeKnownSeedData(saved: Partial<WorkspaceData>): Partial<WorkspaceData> {
  const seedNoteIds = new Set((saved.inspirationNotes ?? []).filter((item) => seedIds.notes.has(item.id)).map((item) => item.id));
  const seedInspirationIds = new Set((saved.inspirations ?? []).filter((item) => seedIds.inspirations.has(item.id)).map((item) => item.id));
  return {
    ...saved,
    todos: saved.todos?.filter((item) => !seedIds.todos.has(item.id)),
    moods: saved.moods?.filter((item) => !seedIds.moods.has(item.id)),
    learning: saved.learning?.filter((item) => !seedIds.learning.has(item.id)),
    english: saved.english?.filter((item) => !item.id.startsWith("english-")),
    fitness: saved.fitness?.filter((item) => !seedIds.fitness.has(item.id)),
    weeklyReviews: saved.weeklyReviews?.filter((item) => !item.completed.includes("完成产品需求文档") && !item.highlights.includes("产品评审获得认可")),
    inspirations: saved.inspirations?.filter((item) => !seedInspirationIds.has(item.id)),
    inspirationNotes: saved.inspirationNotes?.filter((item) => !seedNoteIds.has(item.id)),
    habitCompletions: saved.habitCompletions?.filter((item) => !item.id.startsWith("sleep-")),
    inspirationLinks: saved.inspirationLinks?.filter((item) => !seedNoteIds.has(item.noteId) && !seedInspirationIds.has(item.inspirationId)),
    memories: saved.memories?.filter((item) => !seedIds.memories.has(item.id)),
  };
}
