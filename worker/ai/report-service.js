import { routeAIRequest } from "./router.js";

export const allowedAITypes = new Set(["daily", "weekly", "monthly", "annual", "inspiration", "growth"]);
export const allowedAIScopes = new Set(["todos", "moods", "learning", "english", "fitness", "weekly", "inspiration", "memory"]);

export function normalizeAIRequest(body) {
  const type = String(body?.type || "");
  if (!allowedAITypes.has(type)) throw Object.assign(new Error("不支持的报告类型"), { status: 422 });
  if (body?.consent !== true) throw Object.assign(new Error("使用外部 AI 前需要确认授权范围"), { status: 422 });
  const scopes = Array.from(new Set(Array.isArray(body?.scopes) ? body.scopes.filter((scope) => allowedAIScopes.has(scope)) : []));
  if (!scopes.length) throw Object.assign(new Error("请至少授权一类数据"), { status: 422 });
  return { type, scopes };
}

export async function generateAIReport({ body, workspace, apiKey, fetchImpl, endpoint }) {
  const request = normalizeAIRequest(body);
  return routeAIRequest({ ...request, workspace, apiKey, fetchImpl, endpoint });
}
