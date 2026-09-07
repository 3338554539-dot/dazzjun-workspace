export const AI_MEMORY_TYPES = ["preference", "goal", "habit", "identity", "insight"] as const;

export type AIMemoryType = typeof AI_MEMORY_TYPES[number];

export interface AIMemoryRecord {
  id: string;
  memoryType: AIMemoryType;
  content: string;
  importance: number;
  source: "user" | "ai" | "import";
  createdAt: string;
  updatedAt: string;
}

interface AIMemoryRow extends AIMemoryRecord {}

interface D1Result<T> {
  results?: T[];
  meta?: { changes?: number };
}

interface BoundStatement {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}

export interface AIMemoryDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): BoundStatement;
  };
}

const memoryTypes = new Set<string>(AI_MEMORY_TYPES);
const memorySources = new Set(["user", "ai", "import"]);

export function normalizeAIMemoryInput(input: unknown): Pick<AIMemoryRecord, "memoryType" | "content" | "importance" | "source"> {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const memoryType = String(body.memoryType ?? body.memory_type ?? "").trim();
  const content = String(body.content ?? "").trim();
  const importance = Number(body.importance ?? 3);
  const source = String(body.source ?? "user").trim();

  if (!memoryTypes.has(memoryType)) throw Object.assign(new Error("记忆类型无效"), { status: 422 });
  if (!content || content.length > 2_000) throw Object.assign(new Error("记忆内容需要 1–2000 个字符"), { status: 422 });
  if (!Number.isInteger(importance) || importance < 1 || importance > 5) throw Object.assign(new Error("记忆重要度需要为 1–5"), { status: 422 });
  if (!memorySources.has(source)) throw Object.assign(new Error("记忆来源无效"), { status: 422 });

  return {
    memoryType: memoryType as AIMemoryType,
    content,
    importance,
    source: source as AIMemoryRecord["source"],
  };
}

export async function listAIMemories(db: AIMemoryDatabase, userId: string, limit = 200): Promise<AIMemoryRecord[]> {
  if (!userId) throw Object.assign(new Error("用户身份无效"), { status: 401 });
  const result = await db.prepare("SELECT id,memory_type AS memoryType,content,importance,source,created_at AS createdAt,updated_at AS updatedAt FROM ai_memory WHERE user_id=? ORDER BY importance DESC,updated_at DESC LIMIT ?")
    .bind(userId, Math.min(200, Math.max(1, limit)))
    .all<AIMemoryRow>();
  return result.results ?? [];
}

export async function createAIMemory(db: AIMemoryDatabase, userId: string, input: unknown): Promise<AIMemoryRecord> {
  if (!userId) throw Object.assign(new Error("用户身份无效"), { status: 401 });
  const memory = normalizeAIMemoryInput(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO ai_memory(id,user_id,memory_type,content,importance,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)")
    .bind(id, userId, memory.memoryType, memory.content, memory.importance, memory.source, now, now)
    .run();
  return { id, ...memory, createdAt: now, updatedAt: now };
}

export async function deleteAIMemory(db: AIMemoryDatabase, userId: string, id: string): Promise<boolean> {
  if (!userId) throw Object.assign(new Error("用户身份无效"), { status: 401 });
  const owned = await db.prepare("SELECT id FROM ai_memory WHERE id=? AND user_id=?").bind(id, userId).first<{ id: string }>();
  if (!owned) return false;
  await db.prepare("DELETE FROM ai_memory WHERE id=? AND user_id=?").bind(id, userId).run();
  return true;
}
