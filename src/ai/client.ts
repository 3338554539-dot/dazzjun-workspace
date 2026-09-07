import type { AIDataScope } from "./router";
import type { AIInsightRecord, AIInsightType } from "../data/types";

type AIRequestOptions = RequestInit & { timeoutMs?: number };

async function aiRequest<T>(path: string, options: AIRequestOptions = {}): Promise<T> {
  const { timeoutMs = 0, ...requestOptions } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = timeoutMs > 0 ? globalThis.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs) : undefined;
  let response: Response;
  try {
    response = await fetch(path, { ...requestOptions, credentials: "include", signal: requestOptions.signal ?? controller.signal, headers: { ...(requestOptions.body ? { "content-type": "application/json" } : {}), ...requestOptions.headers } });
  } catch {
    throw new Error(timedOut ? "Dazzjun服务连接超时，请重新连接" : "无法连接 Dazzjun AI Core");
  } finally {
    if (timeout !== undefined) globalThis.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "AI Core 请求失败");
  return payload as T;
}

export type AICoreStatus = { configured: boolean; provider: "DeepSeek"; model: string };
export type AIContextAuthorization = { authorized: boolean; authorizedAt: string | null; updatedAt: string | null };
export type AIConversationMessage = { id: string; conversationId: string; role: "user" | "assistant"; content: string; createdAt: string };
export type AIDailyInsight = { id: string; insightDate: string; summary: string; statusAnalysis: string; growthAdvice: string; generatedAt: string };
export type AIMemoryType = "preference" | "goal" | "habit" | "identity" | "insight";
export type AIMemoryRecord = {
  id: string;
  memoryType: AIMemoryType;
  content: string;
  importance: number;
  source: "user" | "ai" | "import";
  createdAt: string;
  updatedAt: string;
};

export const aiCoreClient = {
  status: () => aiRequest<AICoreStatus>("/api/ai/status", { timeoutMs: 5000 }),
  contextAuthorization: () => aiRequest<AIContextAuthorization>("/api/ai/context-authorization", { timeoutMs: 5000 }),
  setContextAuthorization: (authorized: boolean) => aiRequest<AIContextAuthorization>("/api/ai/context-authorization", { method: "PUT", body: JSON.stringify({ authorized }) }),
  chat: (message: string) => aiRequest<{ success: true; reply: string }>("/api/ai/chat", { method: "POST", body: JSON.stringify({ message }), timeoutMs: 125_000 }),
  conversation: (conversationId = "daily_assistant", limit = 100) => aiRequest<{ conversationId: string; messages: AIConversationMessage[] }>(`/api/ai/conversations?conversation_id=${encodeURIComponent(conversationId)}&limit=${limit}`, { timeoutMs: 5000 }),
  sendConversation: (message: string, conversationId = "daily_assistant", usePersonalContext = true) => aiRequest<{ success: true; conversationId: string; reply: string; messages: AIConversationMessage[] }>("/api/ai/conversations", { method: "POST", body: JSON.stringify({ conversation_id: conversationId, message, use_personal_context: usePersonalContext }), timeoutMs: 125_000 }),
  todayInsight: () => aiRequest<{ insight: AIDailyInsight | null }>("/api/ai/insights/today", { timeoutMs: 5000 }),
  generateTodayInsight: () => aiRequest<{ insight: AIDailyInsight; cached: boolean }>("/api/ai/insights/today", { method: "POST", timeoutMs: 185_000 }),
  memories: () => aiRequest<{ memories: AIMemoryRecord[] }>("/api/ai/memory"),
  addMemory: (input: { memoryType: AIMemoryType; content: string; importance: number }) => aiRequest<{ memory: AIMemoryRecord }>("/api/ai/memory", { method: "POST", body: JSON.stringify({ ...input, source: "user" }) }),
  deleteMemory: (id: string) => aiRequest<{ success: true }>(`/api/ai/memory/${encodeURIComponent(id)}`, { method: "DELETE" }),
  generate: (type: AIInsightType, scopes: AIDataScope[]) => aiRequest<{ insight: AIInsightRecord }>("/api/ai/insights", { method: "POST", body: JSON.stringify({ type, scopes, consent: true }) }),
  reports: () => aiRequest<{ reports: AIInsightRecord[] }>("/api/ai/reports"),
};
