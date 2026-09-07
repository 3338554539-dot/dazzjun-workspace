import { buildDeepSeekMessages } from "../prompts.js";

const DEFAULT_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

function parseModelJSON(content) {
  const raw = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw Object.assign(new Error("DeepSeek 返回了无法解析的报告"), { status: 502 }); }
  const sections = Array.isArray(parsed.sections) ? parsed.sections
    .map((section) => ({ title: String(section?.title || "").trim(), content: String(section?.content || "").trim() }))
    .filter((section) => section.title && section.content)
    .slice(0, 6) : [];
  const title = String(parsed.title || "").trim();
  const summary = String(parsed.summary || "").trim();
  if (!title || !summary || sections.length < 1) throw Object.assign(new Error("DeepSeek 返回的报告结构不完整"), { status: 502 });
  return { title, summary, sections };
}

export async function generateWithDeepSeek({ apiKey, type, workspace, scopes, fetchImpl = fetch, endpoint = DEFAULT_ENDPOINT, model = DEFAULT_MODEL }) {
  if (!apiKey) throw Object.assign(new Error("DeepSeek AI Core 尚未配置"), { status: 503, code: "AI_NOT_CONFIGURED" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: buildDeepSeekMessages(type, workspace, scopes), response_format: { type: "json_object" }, temperature: 0.45, max_tokens: 1800 }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(response.status === 401 ? "DeepSeek 服务认证失败" : "DeepSeek 服务暂时不可用"), { status: response.status === 429 ? 429 : 502 });
    const content = payload?.choices?.[0]?.message?.content;
    const report = parseModelJSON(content);
    const usage = {
      promptTokens: Number(payload?.usage?.prompt_tokens || 0),
      completionTokens: Number(payload?.usage?.completion_tokens || 0),
      totalTokens: Number(payload?.usage?.total_tokens || 0),
    };
    return { type, ...report, generatedAt: new Date().toISOString(), engine: "provider", provider: "DeepSeek", model: String(payload?.model || model), usage };
  } catch (error) {
    if (error?.name === "AbortError") throw Object.assign(new Error("DeepSeek 请求超时，请稍后再试"), { status: 504 });
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function testDeepSeekConnection({ apiKey, fetchImpl = fetch, endpoint = DEFAULT_ENDPOINT, model = DEFAULT_MODEL }) {
  if (!apiKey) throw Object.assign(new Error("DeepSeek AI Core 尚未配置"), { status: 503, code: "AI_NOT_CONFIGURED" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply OK." }], temperature: 0, max_tokens: 2 }),
      signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error(response.status === 401 ? "DeepSeek 服务认证失败" : "DeepSeek 服务暂时不可用"), { status: response.status === 429 ? 429 : 502 });
    return { success: true, model };
  } catch (error) {
    if (error?.name === "AbortError") throw Object.assign(new Error("DeepSeek 请求超时，请稍后再试"), { status: 504 });
    throw error;
  } finally { clearTimeout(timeout); }
}

export const deepSeekProvider = { id: "deepseek", name: "DeepSeek", model: DEFAULT_MODEL };
export { parseModelJSON };
