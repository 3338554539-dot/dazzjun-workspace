import type { WorkspaceData } from "../../data/types";
import { aiCoreClient, type AICoreStatus } from "../client";
import type { ExternalAIProvider } from "../router";

export function createDeepSeekProvider(status: AICoreStatus): ExternalAIProvider {
  return {
    id: "deepseek",
    name: "DeepSeek AI Core",
    kind: "custom",
    available: status.configured,
    privateByDefault: false,
    supports: ["daily", "weekly", "monthly", "annual", "inspiration", "growth"],
    async generate(request, _data: WorkspaceData) {
      const { insight } = await aiCoreClient.generate(request.type, request.approvedScopes);
      const { id: _id, ...record } = insight;
      return record;
    },
  };
}
