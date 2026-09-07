import { listAIMemories, type AIMemoryDatabase } from "./memory.ts";
import { dateInTimeZone, getTodayTasks } from "./todoSelectors.ts";

const MAX_CONTEXT_LENGTH = 11_500;

interface WorkspaceRow {
  payload?: string;
}

export interface AIContextDatabase extends AIMemoryDatabase {}

export interface LoadAIContextInput {
  db: AIContextDatabase;
  userId: string;
  now?: Date;
}

type UnknownRecord = Record<string, unknown>;

const records = (value: unknown): UnknownRecord[] => Array.isArray(value)
  ? value.filter((item): item is UnknownRecord => Boolean(item) && typeof item === "object")
  : [];

const text = (value: unknown, maxLength = 180): string => String(value ?? "").trim().slice(0, maxLength);
const number = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const boolean = (value: unknown): boolean => value === true;

function recent(items: UnknownRecord[], keys: string[], limit: number): UnknownRecord[] {
  return [...items]
    .sort((a, b) => {
      const dateFor = (item: UnknownRecord) => keys.map((key) => text(item[key], 40)).find(Boolean) ?? "";
      return dateFor(b).localeCompare(dateFor(a));
    })
    .slice(0, limit);
}

export function buildAIContext(workspace: unknown, now = new Date(), memories: unknown = []): string {
  const data = workspace && typeof workspace === "object" ? workspace as UnknownRecord : {};
  const today = dateInTimeZone(now);
  const todayTodoRecords = getTodayTasks(records(data.todos), today);
  const todos = recent(todayTodoRecords, ["scheduleDate", "deadline", "createdAt"], 10).map((item) => ({
    title: text(item.title), category: text(item.category, 30), priority: text(item.priority, 20),
    scheduleDate: text(item.scheduleDate, 10), deadline: text(item.deadline ?? item.dueAt, 40), done: boolean(item.done),
  }));
  const moods = recent(records(data.moods), ["date", "updatedAt"], 6).map((item) => ({
    date: text(item.date, 20), mood: text(item.mood, 30), score: number(item.score),
    story: text(item.story), note: text(item.note),
  }));
  const study = recent(records(data.learning), ["date", "createdAt"], 6).map((item) => ({
    date: text(item.date, 20), topic: text(item.title), category: text(item.category, 30),
    durationMinutes: number(item.duration), content: text(item.content), gain: text(item.gain),
  }));
  const english = recent(records(data.english), ["date", "updatedAt"], 6).map((item) => ({
    date: text(item.date, 20), checkedIn: boolean(item.checkedIn), durationMinutes: number(item.duration),
    words: number(item.words), exercises: number(item.exercises), categories: Array.isArray(item.categories) ? item.categories.map((value) => text(value, 30)).slice(0, 4) : [], note: text(item.note),
  }));
  const fitness = recent(records(data.fitness), ["date", "createdAt"], 6).map((item) => ({
    date: text(item.date, 20), activity: text(item.title), durationMinutes: number(item.duration),
    calories: number(item.calories), completed: boolean(item.completed), plan: text(item.plan),
  }));
  const inspirationCategories = new Map(records(data.inspirationCategories).map((item) => [text(item.id, 100), text(item.name, 60)]));
  const inspiration = recent(records(data.inspirations), ["createdAt"], 6).map((item) => ({
    createdAt: text(item.createdAt, 40), platform: text(item.platform, 30), title: text(item.title ?? item.content), author: text(item.author, 120),
    tags: Array.isArray(item.aiTags) ? item.aiTags.map((value) => text(value, 40)).slice(0, 12) : [],
    category: text(item.categoryName, 60) || inspirationCategories.get(text(item.categoryId, 100)) || "未分类", saved: boolean(item.saved),
  }));
  const inspirationNotes = recent(records(data.inspirationNotes), ["updatedAt", "createdAt"], 4).map((item) => ({
    createdAt: text(item.createdAt, 40), title: text(item.title), content: text(item.content),
    tags: Array.isArray(item.tags) ? item.tags.map((value) => text(value, 40)).slice(0, 8) : [],
  }));
  const longTermMemory = records(memories).slice(0, 60).map((item) => ({
    memoryType: text(item.memoryType ?? item.memory_type, 30),
    content: text(item.content, 500),
    importance: Math.min(5, Math.max(1, number(item.importance))),
    source: text(item.source, 30),
    updatedAt: text(item.updatedAt ?? item.updated_at, 40),
  }));

  const context = {
    generatedAt: now.toISOString(),
    today,
    structure: ["Short Term Context", "Long Term Memory", "Current Task"],
    scope: ["Todo", "Mood", "Study", "English", "Fitness", "Inspiration", "AI Memory"],
    shortTermContext: {
      counts: {
        todo: todayTodoRecords.length,
        mood: records(data.moods).length,
        study: records(data.learning).length,
        english: records(data.english).length,
        fitness: records(data.fitness).length,
        inspiration: records(data.inspirations).length + records(data.inspirationNotes).length,
      },
      recent: { todo: todos, mood: moods, study, english, fitness, inspiration, inspirationNotes },
    },
    longTermMemory,
  };
  const serialized = JSON.stringify(context);
  return serialized.length <= MAX_CONTEXT_LENGTH ? serialized : `${serialized.slice(0, MAX_CONTEXT_LENGTH)}\n[上下文已安全截断]`;
}

export async function loadAIContext({ db, userId, now }: LoadAIContextInput): Promise<string> {
  if (!userId) throw Object.assign(new Error("用户身份无效"), { status: 401 });
  const row = await db.prepare("SELECT payload_json AS payload FROM user_workspaces WHERE user_id=?")
    .bind(userId)
    .first<WorkspaceRow>();
  let workspace: unknown = {};
  if (row?.payload) {
    try { workspace = JSON.parse(row.payload); }
    catch { throw Object.assign(new Error("工作台上下文暂时无法读取"), { status: 500 }); }
  }
  const memories = await listAIMemories(db, userId, 60);
  return buildAIContext(workspace, now, memories);
}
