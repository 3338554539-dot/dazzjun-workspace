import type { AIChatMessage } from "./prompt.ts";

const DEFAULT_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";
export const DEEPSEEK_CHAT_TIMEOUT_MS = 60_000;
export const DEEPSEEK_INSIGHT_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 1_000;
const MAX_ATTEMPTS = 2;

export interface DeepSeekUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface DeepSeekChatResult {
  success: true;
  content: string;
  usage: DeepSeekUsage;
}

interface DeepSeekPayload {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface DeepSeekChatOptions {
  apiKey: string | undefined;
  messages: AIChatMessage[];
  fetchImpl?: FetchImplementation;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  retryDelayMs?: number;
}

type DeepSeekServiceError = Error & { status: number; code?: string; retryable?: boolean };

function serviceError(message: string, status: number, code?: string, retryable = false): DeepSeekServiceError {
  return Object.assign(new Error(message), { status, ...(code ? { code } : {}), retryable });
}

function tokenCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export async function chatWithDeepSeek({
  apiKey,
  messages,
  fetchImpl = fetch,
  endpoint = DEFAULT_ENDPOINT,
  model = DEFAULT_MODEL,
  timeoutMs = DEEPSEEK_CHAT_TIMEOUT_MS,
  retryDelayMs = RETRY_DELAY_MS,
}: DeepSeekChatOptions): Promise<DeepSeekChatResult> {
  if (!apiKey) throw serviceError("DeepSeek AI Core 尚未配置", 503, "AI_NOT_CONFIGURED");

  const execute = async (): Promise<DeepSeekChatResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, temperature: 0.55, max_tokens: 1600 }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as DeepSeekPayload;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw serviceError("DeepSeek API 认证失败", 502, "DEEPSEEK_API_AUTH");
        if (response.status === 429) throw serviceError("DeepSeek API 请求过于频繁，请稍后再试", 429, "DEEPSEEK_RATE_LIMIT", true);
        throw serviceError(`DeepSeek API 返回错误（HTTP ${response.status}）`, 502, "DEEPSEEK_API_ERROR", response.status >= 500);
      }
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw serviceError("DeepSeek API 返回内容无效", 502, "DEEPSEEK_RESPONSE_INVALID", true);
      return {
        success: true,
        content: content.trim(),
        usage: {
          promptTokens: tokenCount(payload.usage?.prompt_tokens),
          completionTokens: tokenCount(payload.usage?.completion_tokens),
          totalTokens: tokenCount(payload.usage?.total_tokens),
        },
      };
    } catch (error) {
      if ((error as DeepSeekServiceError)?.status) throw error;
      if (error instanceof Error && error.name === "AbortError") throw serviceError("DeepSeek 请求超时，请稍后再试", 504, "DEEPSEEK_TIMEOUT", true);
      throw serviceError("无法连接 DeepSeek 服务，请检查网络后重试", 502, "DEEPSEEK_NETWORK_ERROR", true);
    } finally {
      clearTimeout(timeout);
    }
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try { return await execute(); }
    catch (error) {
      const retryable = (error as DeepSeekServiceError)?.retryable === true;
      if (!retryable || attempt === MAX_ATTEMPTS - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw serviceError("DeepSeek API 请求失败", 502, "DEEPSEEK_API_ERROR");
}

export const deepSeekChatConfig = { provider: "DeepSeek", model: DEFAULT_MODEL } as const;
