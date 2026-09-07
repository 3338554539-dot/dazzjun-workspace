import { generateWithDeepSeek } from "./providers/deepseek.js";

export async function routeAIRequest({ provider = "deepseek", ...request }) {
  if (provider !== "deepseek") throw Object.assign(new Error("不支持的 AI Provider"), { status: 422 });
  return generateWithDeepSeek(request);
}
