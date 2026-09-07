import type { InspirationPlatform, LearningFileBlock, LearningImageBlock, LearningLinkBlock, WorkspaceData } from "../data/types";
import type { DazzjunUser } from "../models/user";
import type { ThemeId, WorkspaceTheme } from "../theme";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type RequestOptions = RequestInit & { timeoutMs?: number };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 0, ...requestOptions } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = timeoutMs > 0 ? globalThis.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs) : undefined;
  let response: Response;
  try {
    const isFormData = typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
    response = await fetch(path, { ...requestOptions, credentials: "include", signal: requestOptions.signal ?? controller.signal, headers: { ...(requestOptions.body && !isFormData ? { "content-type": "application/json" } : {}), ...requestOptions.headers } });
  } catch {
    throw new ApiError(timedOut ? "Dazzjun服务连接超时，请重新连接" : "无法连接 Dazzjun 服务", 0);
  } finally {
    if (timeout !== undefined) globalThis.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/auth/session" && path !== "/api/auth/login") window.dispatchEvent(new Event("dazzjun:session-expired"));
    throw new ApiError(payload.error || "请求失败", response.status);
  }
  return payload as T;
}

export const authApi = {
  session: () => request<{ user: DazzjunUser }>("/api/auth/session", { timeoutMs: 5000 }),
  register: (input: { email: string; password: string; displayName: string }) => request<{ user: DazzjunUser }>("/api/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) => request<{ user: DazzjunUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(input) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  updateProfile: (input: Pick<DazzjunUser, "displayName" | "bio"> & { avatarUrl?: string | null }) => request<{ user: DazzjunUser }>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(input) }),
  changePassword: (input: { currentPassword: string; nextPassword: string }) => request<{ ok: true }>("/api/auth/password", { method: "POST", body: JSON.stringify(input) }),
};

export const workspaceApi = {
  get: () => request<{ data: WorkspaceData; version: number; updatedAt: string }>("/api/workspace", { timeoutMs: 5000 }),
  save: (data: WorkspaceData) => request<{ updatedAt: string }>("/api/workspace", { method: "PUT", body: JSON.stringify({ data }), timeoutMs: 15_000 }),
};

export interface InspirationCaptureResult {
  platform: InspirationPlatform;
  title: string;
  cover: string;
  author: string;
  tags: string[];
  url: string;
}

export interface DailyInspiration {
  id: string;
  title: string;
  cover: string;
  image: string;
  platform: InspirationPlatform;
  category_name: string;
  source: string;
  ai_tags: string[];
}

export const inspirationApi = {
  random: () => request<DailyInspiration | null>("/api/inspiration/random", { timeoutMs: 5000 }),
  capture: (input: { url?: string; sourceText?: string }) => request<InspirationCaptureResult>("/api/inspiration/capture", {
    method: "POST",
    body: JSON.stringify(input),
  }),
};

export const learningApi = {
  upload: async (input: { learningId: string; file: File; thumbnail?: Blob }) => {
    const form = new FormData();
    form.set("learning_id", input.learningId);
    form.set("file", input.file, input.file.name);
    if (input.thumbnail) form.set("thumbnail", input.thumbnail, `thumbnail-${input.file.name.replace(/\.[^.]+$/u, "")}.webp`);
    return request<{ block: LearningImageBlock | LearningFileBlock }>("/api/learning/assets", { method: "POST", body: form, timeoutMs: 60_000 });
  },
  deleteAsset: (assetId: string) => request<{ success: true }>(`/api/learning/assets/${encodeURIComponent(assetId)}`, { method: "DELETE" }),
  confirmAssets: (learningId: string, assetIds: string[]) => request<{ success: true; learningId: string; assets: Array<{ id: string; status: "attached"; attachedAt: string }> }>("/api/learning/assets/confirm", { method: "POST", body: JSON.stringify({ learningId, assetIds }), timeoutMs: 15_000 }),
  previewLink: (url: string) => request<{ block: LearningLinkBlock }>("/api/learning/link-preview", { method: "POST", body: JSON.stringify({ url }), timeoutMs: 12_000 }),
};

export type ThemePreferences = { themeId: ThemeId; customThemes: WorkspaceTheme[]; updatedAt?: string };
export const preferenceApi = {
  get: () => request<ThemePreferences>("/api/preferences", { timeoutMs: 5000 }),
  save: (preferences: ThemePreferences) => request<{ updatedAt: string }>("/api/preferences", { method: "PUT", body: JSON.stringify(preferences) }),
};
