export type DazzjunAIAction = "daily-summary" | "weekly-summary" | "monthly-analysis" | "learning-organize" | "inspiration-analysis" | "growth-advice" | "year-report";

export { aiPermissionPolicy, localInsightProvider, routeAIRequest } from "../ai/router";
export type { AIDataScope, AIExecutionRequest, AIExecutionResult, AIProviderDescriptor, ExternalAIProvider } from "../ai/router";

export interface DazzjunAIContext {
  action: DazzjunAIAction;
  locale: "zh-CN";
  payload: unknown;
}

export interface DazzjunAIProvider {
  id: string;
  generate(context: DazzjunAIContext): Promise<{ text: string }>;
}

export class AIProviderNotConfiguredError extends Error {
  constructor() {
    super("AI Assistant 接口已预留，尚未配置模型提供方。");
  }
}

export async function runDazzjunAI(_context: DazzjunAIContext, provider?: DazzjunAIProvider) {
  if (!provider) throw new AIProviderNotConfiguredError();
  return provider.generate(_context);
}
