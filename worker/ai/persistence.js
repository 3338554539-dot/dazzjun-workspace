export const DEFAULT_CONVERSATION_ID = "daily_assistant";
export const MAX_CONVERSATION_MESSAGES = 200;

const DAILY_INSIGHT_PROMPT = `请基于系统自动提供的当前工作台数据，为我生成今日洞察。只返回合法 JSON，不要 Markdown，格式必须是：{"summary":"今日总结","statusAnalysis":"状态分析","growthAdvice":"成长建议"}。不要虚构没有记录的事实，数据不足时直接说明。`;

function validationError(message) {
  return Object.assign(new Error(message), { status: 422 });
}

export function normalizeConversationId(value) {
  const conversationId = String(value || DEFAULT_CONVERSATION_ID).trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(conversationId)) {
    throw validationError("AI 场景标识格式无效");
  }
  return conversationId;
}

export function normalizeConversationLimit(value) {
  if (value === undefined || value === null || value === "") return 100;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) throw validationError("历史消息数量无效");
  return Math.min(MAX_CONVERSATION_MESSAGES, limit);
}

export function shanghaiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function parseDailyInsight(content) {
  const raw = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!raw) throw Object.assign(new Error("DeepSeek 返回内容无效"), { status: 502 });
  try {
    const value = JSON.parse(raw);
    if (typeof value.summary === "string" && typeof value.statusAnalysis === "string" && typeof value.growthAdvice === "string") {
      return {
        summary: value.summary.trim(),
        statusAnalysis: value.statusAnalysis.trim(),
        growthAdvice: value.growthAdvice.trim(),
      };
    }
  } catch {
    // Preserve a useful summary when the provider omits the requested JSON wrapper.
  }
  return { summary: raw, statusAnalysis: "", growthAdvice: "" };
}

export function dailyInsightPrompt() {
  return DAILY_INSIGHT_PROMPT;
}

export function conversationMessages({ conversationId, message, reply, userCreatedAt, assistantCreatedAt, ids }) {
  return [
    { id: ids.user, conversationId, role: "user", content: message.trim(), createdAt: userCreatedAt },
    { id: ids.assistant, conversationId, role: "assistant", content: reply.trim(), createdAt: assistantCreatedAt },
  ];
}
