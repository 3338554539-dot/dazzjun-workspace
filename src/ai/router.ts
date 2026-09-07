import type { AIInsightRecord, AIInsightType, WorkspaceData } from "../data/types";
import { generateLocalInsight } from "./localInsightEngine";

export type AIProviderKind = "local" | "openai" | "anthropic" | "custom";
export type AIDataScope = "todos" | "moods" | "learning" | "english" | "fitness" | "weekly" | "inspiration" | "memory";

export interface AIProviderDescriptor {
  id: string;
  name: string;
  kind: AIProviderKind;
  available: boolean;
  privateByDefault: boolean;
  supports: AIInsightType[];
}

export interface AIExecutionRequest {
  type: AIInsightType;
  preferredProvider?: string;
  allowExternal: boolean;
  approvedScopes: AIDataScope[];
}

export interface AIExecutionResult {
  insight: Omit<AIInsightRecord, "id">;
  route: AIProviderDescriptor;
  usedScopes: AIDataScope[];
}

export interface ExternalAIProvider extends AIProviderDescriptor {
  generate(request: AIExecutionRequest, data: WorkspaceData): Promise<Omit<AIInsightRecord, "id">>;
}

export const localInsightProvider: AIProviderDescriptor = {
  id: "dazzjun-local-insight",
  name: "Dazzjun Local Insight",
  kind: "local",
  available: true,
  privateByDefault: true,
  supports: ["daily", "weekly", "monthly", "annual", "inspiration", "growth"],
};

export async function routeAIRequest(request: AIExecutionRequest, data: WorkspaceData, providers: ExternalAIProvider[] = []): Promise<AIExecutionResult> {
  const external = providers.find((provider) => provider.available && provider.supports.includes(request.type) && (!request.preferredProvider || provider.id === request.preferredProvider));
  if (external && request.allowExternal) return { insight: await external.generate(request, data), route: external, usedScopes: request.approvedScopes };
  return { insight: generateLocalInsight(request.type, data), route: localInsightProvider, usedScopes: request.approvedScopes };
}

export const aiPermissionPolicy = {
  localProcessing: "always-allowed" as const,
  externalProcessing: "explicit-confirmation-required" as const,
  defaultScopes: ["todos", "moods", "learning", "english", "fitness", "weekly", "inspiration", "memory"] as AIDataScope[],
};

