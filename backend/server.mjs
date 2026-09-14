import http from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  confirmLearningAssets, createAIMemory, createLearningAsset, createSession, createUser, databaseInfo, deleteAIConversation, deleteAIMemory, deleteLearningAsset, deleteSession, deleteUserSessions, findSessionUser, findUserByEmail,
  getAIContextAuthorization, getAIDailyInsight, getDailyInspiration, getPasswordRecord, getPreferences, getWorkspace, listAIConversation, listAIMemories, listAIReports,
  checkRateLimitBucket, clearRateLimitBuckets, consumeRateLimitBucket, getLearningAsset, maybeCleanupRateLimitBuckets, saveAIConversationExchange, saveAIDailyInsight, saveAIReport, savePreferences, saveWorkspace, setAIContextAuthorization, updatePassword, updateUserProfile,
} from "./database.mjs";
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./security.mjs";
import { generateAIReport, normalizeAIRequest } from "../worker/ai/report-service.js";
import { buildAIContext } from "../worker/ai/chat-runtime/context.js";
import { generateAIResponse, validateAIMessage } from "../worker/ai/chat-runtime/service.js";
import { DEEPSEEK_CHAT_TIMEOUT_MS, DEEPSEEK_INSIGHT_TIMEOUT_MS } from "../worker/ai/chat-runtime/deepseek.js";
import { normalizeAIMemoryInput } from "../worker/ai/chat-runtime/memory.js";
import { conversationMessages, dailyInsightPrompt, normalizeConversationId, normalizeConversationLimit, parseDailyInsight, shanghaiDate } from "../worker/ai/persistence.js";
import { captureInspiration } from "../worker/inspiration/capture.js";
import { learningBlockFromRow } from "../worker/learning/assets.js";
import { validateLearningFile, validateLearningThumbnail } from "../worker/learning/file-security.js";
import { previewLearningLink } from "../worker/learning/link-preview.js";
import { hashRateLimitIdentifier, rateLimitConfig, rateLimitError } from "../worker/security/rate-limit.js";

const port = Number(process.env.DAZZJUN_API_PORT || 8788);
const sessionDays = 30;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const learningAssetDir = path.resolve(process.env.DAZZJUN_LEARNING_ASSET_DIR || path.join(root, ".data", "learning-assets"));

const json = (response, status, body, headers = {}) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  response.end(JSON.stringify(body));
};

const parseCookies = (request) => Object.fromEntries((request.headers.cookie || "").split(";").map((item) => item.trim().split("=")).filter(([key]) => key).map(([key, value]) => [key, decodeURIComponent(value || "")]));
const sessionCookie = (token, maxAge = sessionDays * 86400) => `dazzjun_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const safeUser = (user) => user && ({ id: user.id, email: user.email, phone: user.phone ?? null, displayName: user.displayName, bio: user.bio, avatarUrl: user.avatarUrl ?? null, createdAt: user.createdAt, updatedAt: user.updatedAt });
const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function trustedOrigin(request, url) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const source = new URL(origin);
    if (source.host === url.host) return true;
    const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
    return localHosts.has(source.hostname) && localHosts.has(url.hostname);
  } catch { return false; }
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 16 * 1024 * 1024) throw Object.assign(new Error("请求内容过大"), { status: 413 });
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error("JSON 格式无效"), { status: 400 }); }
}

async function readFormData(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 28 * 1024 * 1024) throw Object.assign(new Error("附件超过 25MB 限制"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers["content-type"] || "" } }).formData();
  } catch { throw Object.assign(new Error("无法读取上传内容"), { status: 400 }); }
}

const safeLearningName = (value) => String(value || "学习附件").normalize("NFKC").replace(/[\\/\0<>:"|?*]+/gu, "-").replace(/\s+/gu, " ").trim().slice(0, 180) || "学习附件";
const localAssetPath = (key) => {
  const resolved = path.resolve(learningAssetDir, String(key || ""));
  if (!resolved.startsWith(`${learningAssetDir}${path.sep}`)) throw Object.assign(new Error("附件路径无效"), { status: 422 });
  return resolved;
};

async function saveLocalLearningAsset(request, userId) {
  const form = await readFormData(request);
  const file = form.get("file");
  if (!(file instanceof File)) throw Object.assign(new Error("请选择需要上传的文件"), { status: 422 });
  if (!file.size) throw Object.assign(new Error("文件不能为空"), { status: 422 });
  const name = safeLearningName(file.name);
  const learningId = String(form.get("learning_id") || "");
  if (!/^[a-zA-Z0-9_-]{8,120}$/u.test(learningId)) throw Object.assign(new Error("学习日志标识无效"), { status: 422 });
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const { mime, blockType } = validateLearningFile({ name, mime: file.type, bytes: fileBytes, size: file.size });
  const id = crypto.randomUUID();
  const relativeDir = path.posix.join("users", userId, "learning", learningId, id);
  const absoluteDir = localAssetPath(relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  const objectKey = path.posix.join(relativeDir, "original");
  const thumbnail = form.get("thumbnail");
  const hasThumbnail = blockType === "image" && thumbnail instanceof File && thumbnail.size > 0;
  let thumbnailBytes;
  if (hasThumbnail) {
    thumbnailBytes = new Uint8Array(await thumbnail.arrayBuffer());
    validateLearningThumbnail({ mime: thumbnail.type, bytes: thumbnailBytes, size: thumbnail.size });
  }
  const thumbnailKey = hasThumbnail ? path.posix.join(relativeDir, "thumbnail.webp") : objectKey;
  try {
    await writeFile(localAssetPath(objectKey), fileBytes);
    if (hasThumbnail) await writeFile(localAssetPath(thumbnailKey), thumbnailBytes);
    const createdAt = new Date().toISOString();
    const row = createLearningAsset(userId, { id, learningId, blockType, objectKey, thumbnailKey, name, size: file.size, mime, createdAt });
    return learningBlockFromRow(row);
  } catch (error) {
    await rm(absoluteDir, { recursive: true, force: true });
    throw error;
  }
}

async function localRateLimitKey(config, identifier) {
  return await hashRateLimitIdentifier(config.scope, identifier);
}

async function checkLocalRateLimit(config, identifier, message) {
  const key = await localRateLimitKey(config, identifier);
  const state = checkRateLimitBucket(config, key);
  if (!state.allowed) throw rateLimitError(message, state.retryAfter);
  return key;
}

async function consumeLocalRateLimit(config, identifier, message) {
  const key = await localRateLimitKey(config, identifier);
  const state = consumeRateLimitBucket(config, key);
  if (!state.allowed) throw rateLimitError(message, state.retryAfter);
  try { maybeCleanupRateLimitBuckets(key); }
  catch (error) { console.warn("Rate-limit cleanup skipped", error); }
  return key;
}

async function enforceLocalAIQuota(userId) {
  const config = rateLimitConfig(process.env);
  await consumeLocalRateLimit(config.aiPerMinute, userId, "请求太频繁，请稍后再试");
  await consumeLocalRateLimit(config.aiPerDay, userId, "今天的 AI 使用额度已达到上限");
}

function currentSession(request) {
  const token = parseCookies(request).dazzjun_session;
  return token ? { token, tokenHash: hashSessionToken(token), user: findSessionUser(hashSessionToken(token)) } : { user: undefined };
}

function requireUser(request) {
  const session = currentSession(request);
  if (!session.user) throw Object.assign(new Error("请先登录"), { status: 401 });
  return session;
}

function issueSession(userId) {
  const token = createSessionToken();
  createSession(userId, hashSessionToken(token), new Date(Date.now() + sessionDays * 86400_000).toISOString());
  return token;
}

function requireAIContextAuthorization(userId) {
  const authorization = getAIContextAuthorization(userId);
  if (!authorization.authorized) throw Object.assign(new Error("请先授权 Dazzjun AI 使用个人数据"), { status: 403 });
  return authorization;
}

async function createConversationReply(userId, conversationId, message) {
  requireAIContextAuthorization(userId);
  validateAIMessage(message);
  await enforceLocalAIQuota(userId);
  const userCreatedAt = new Date().toISOString();
  const { data } = getWorkspace(userId);
  const result = await generateAIResponse({
    userId,
    message,
    context: buildAIContext(data, new Date(), listAIMemories(userId, 60)),
    apiKey: process.env.DEEPSEEK_API_KEY,
    endpoint: process.env.DEEPSEEK_API_ENDPOINT,
    timeoutMs: DEEPSEEK_CHAT_TIMEOUT_MS,
  });
  const assistantCreatedAt = new Date(Math.max(Date.now(), new Date(userCreatedAt).getTime() + 1)).toISOString();
  const messages = conversationMessages({
    conversationId,
    message,
    reply: result.content,
    userCreatedAt,
    assistantCreatedAt,
    ids: { user: crypto.randomUUID(), assistant: crypto.randomUUID() },
  });
  try { saveAIConversationExchange(userId, messages); }
  catch { throw Object.assign(new Error("AI 回复已生成，但数据库对话保存失败，请重试"), { status: 503, code: "D1_SAVE_FAILED" }); }
  return { reply: result.content, messages };
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/api/health" && request.method === "GET") return json(response, 200, { status: "ok", runtime: "node-local", database: databaseInfo().exists ? "connected" : "unavailable", timestamp: new Date().toISOString() });
  if (mutationMethods.has(request.method) && !trustedOrigin(request, url)) return json(response, 403, { error: "请求来源无效" });

  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    const body = await readBody(request); const email = normalizeEmail(body.email); const password = String(body.password || ""); const displayName = String(body.displayName || "").trim();
    await consumeLocalRateLimit(rateLimitConfig(process.env).registerIpRequests, request.socket.remoteAddress || "unknown", "尝试次数过多，请稍后再试");
    if (!validEmail(email)) return json(response, 422, { error: "请输入有效邮箱" });
    if (password.length < 8) return json(response, 422, { error: "密码至少需要 8 位" });
    if (displayName.length < 2 || displayName.length > 30) return json(response, 422, { error: "名称需要 2–30 个字符" });
    if (findUserByEmail(email)) return json(response, 409, { error: "这个邮箱已经注册" });
    const credentials = hashPassword(password);
    const user = createUser({ email, displayName, passwordHash: credentials.hash, passwordSalt: credentials.salt });
    const token = issueSession(user.id);
    return json(response, 201, { user: safeUser(user) }, { "set-cookie": sessionCookie(token) });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await readBody(request); const email = normalizeEmail(body.email); const password = String(body.password || "");
    const config = rateLimitConfig(process.env); const address = request.socket.remoteAddress || "unknown";
    await checkLocalRateLimit(config.loginIpFailures, address, "尝试次数过多，请稍后再试");
    const accountKey = await checkLocalRateLimit(config.loginAccountFailures, email, "尝试次数过多，请稍后再试");
    const record = findUserByEmail(email);
    if (!record || !verifyPassword(password, record.password_salt, record.password_hash)) {
      await consumeLocalRateLimit(config.loginIpFailures, address, "尝试次数过多，请稍后再试");
      await consumeLocalRateLimit(config.loginAccountFailures, email, "尝试次数过多，请稍后再试");
      return json(response, 401, { error: "邮箱或密码不正确" });
    }
    clearRateLimitBuckets([{ scope: config.loginAccountFailures.scope, key: accountKey }]);
    const token = issueSession(record.id);
    return json(response, 200, { user: safeUser({ ...record, displayName: record.display_name, avatarUrl: record.avatar_url, createdAt: record.created_at, updatedAt: record.updated_at }) }, { "set-cookie": sessionCookie(token) });
  }

  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    const { user } = currentSession(request);
    return user ? json(response, 200, { user: safeUser(user) }) : json(response, 401, { error: "未登录" });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const session = currentSession(request); if (session.tokenHash) deleteSession(session.tokenHash);
    return json(response, 200, { ok: true }, { "set-cookie": sessionCookie("", 0) });
  }

  if (url.pathname === "/api/auth/profile" && request.method === "PATCH") {
    const { user } = requireUser(request); const body = await readBody(request);
    const displayName = String(body.displayName ?? user.displayName).trim(); const bio = String(body.bio ?? user.bio).trim();
    if (displayName.length < 2 || displayName.length > 30 || bio.length > 120) return json(response, 422, { error: "请检查名称或签名长度" });
    return json(response, 200, { user: safeUser(updateUserProfile(user.id, { displayName, bio, avatarUrl: body.avatarUrl })) });
  }

  if (url.pathname === "/api/auth/password" && request.method === "POST") {
    const { user } = requireUser(request); const body = await readBody(request); const currentPassword = String(body.currentPassword || ""); const nextPassword = String(body.nextPassword || "");
    const record = getPasswordRecord(user.id);
    if (!record || !verifyPassword(currentPassword, record.passwordSalt, record.passwordHash)) return json(response, 401, { error: "当前密码不正确" });
    if (nextPassword.length < 8) return json(response, 422, { error: "新密码至少需要 8 位" });
    const credentials = hashPassword(nextPassword); updatePassword(user.id, credentials.hash, credentials.salt); deleteUserSessions(user.id);
    const token = issueSession(user.id);
    return json(response, 200, { ok: true }, { "set-cookie": sessionCookie(token) });
  }

  if (url.pathname === "/api/workspace" && request.method === "GET") return json(response, 200, getWorkspace(requireUser(request).user.id));
  if (url.pathname === "/api/workspace" && request.method === "PUT") {
    const { user } = requireUser(request); const body = await readBody(request);
    if (!body.data || !Array.isArray(body.data.todos) || !Array.isArray(body.data.memories)) return json(response, 422, { error: "工作台数据结构无效" });
    return json(response, 200, saveWorkspace(user.id, body.data));
  }
  if (url.pathname === "/api/inspiration/capture" && request.method === "POST") {
    requireUser(request);
    const body = await readBody(request);
    return json(response, 200, await captureInspiration({ url: body.url, sourceText: body.sourceText }));
  }
  if (url.pathname === "/api/inspiration/random" && request.method === "GET") {
    const { user } = requireUser(request);
    return json(response, 200, getDailyInspiration(user.id, shanghaiDate()));
  }
  if (url.pathname === "/api/learning/assets" && request.method === "POST") {
    const { user } = requireUser(request);
    return json(response, 201, { block: await saveLocalLearningAsset(request, user.id) });
  }
  if (url.pathname === "/api/learning/assets/confirm" && request.method === "POST") {
    const { user } = requireUser(request);
    const body = await readBody(request);
    return json(response, 200, confirmLearningAssets(user.id, body.learningId, body.assetIds));
  }
  if (url.pathname === "/api/learning/link-preview" && request.method === "POST") {
    requireUser(request);
    const body = await readBody(request);
    return json(response, 200, { block: await previewLearningLink(body.url) });
  }
  if (url.pathname.startsWith("/api/learning/assets/") && request.method === "GET") {
    const { user } = requireUser(request);
    const assetId = decodeURIComponent(url.pathname.slice("/api/learning/assets/".length));
    const asset = getLearningAsset(user.id, assetId);
    if (!asset) return json(response, 404, { error: "附件不存在" });
    const thumbnail = url.searchParams.get("variant") === "thumbnail" && asset.blockType === "image";
    const key = thumbnail ? asset.thumbnailKey || asset.objectKey : asset.objectKey;
    const body = await readFile(localAssetPath(key)).catch(() => null);
    if (!body) return json(response, 404, { error: "附件文件不存在" });
    const inline = url.searchParams.get("download") !== "1" && (asset.blockType === "image" || asset.mime === "application/pdf" || asset.mime === "text/plain");
    const contentType = thumbnail && asset.thumbnailKey !== asset.objectKey ? "image/webp" : asset.mime;
    response.writeHead(200, { "content-type": contentType, "content-length": body.length, "cache-control": "private, max-age=3600", "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(asset.name)}`, "x-content-type-options": "nosniff" });
    return response.end(body);
  }
  if (url.pathname.startsWith("/api/learning/assets/") && request.method === "DELETE") {
    const { user } = requireUser(request);
    const assetId = decodeURIComponent(url.pathname.slice("/api/learning/assets/".length));
    const asset = deleteLearningAsset(user.id, assetId);
    if (!asset) return json(response, 404, { error: "附件不存在" });
    await rm(path.dirname(localAssetPath(asset.objectKey)), { recursive: true, force: true });
    return json(response, 200, { success: true });
  }
  if (url.pathname === "/api/ai/status" && request.method === "GET") {
    requireUser(request);
    return json(response, 200, { configured: Boolean(process.env.DEEPSEEK_API_KEY), provider: "DeepSeek", model: "deepseek-chat" });
  }
  if (url.pathname === "/api/ai/context-authorization" && request.method === "GET") {
    return json(response, 200, getAIContextAuthorization(requireUser(request).user.id));
  }
  if (url.pathname === "/api/ai/context-authorization" && request.method === "PUT") {
    const { user } = requireUser(request); const body = await readBody(request);
    if (typeof body.authorized !== "boolean") return json(response, 422, { error: "授权状态必须是布尔值" });
    return json(response, 200, setAIContextAuthorization(user.id, body.authorized));
  }
  if (url.pathname === "/api/ai/memory" && request.method === "GET") {
    return json(response, 200, { memories: listAIMemories(requireUser(request).user.id) });
  }
  if (url.pathname === "/api/ai/memory" && request.method === "POST") {
    const { user } = requireUser(request); const body = await readBody(request);
    return json(response, 201, { memory: createAIMemory(user.id, normalizeAIMemoryInput({ ...body, source: "user" })) });
  }
  if (url.pathname.startsWith("/api/ai/memory/") && request.method === "DELETE") {
    const { user } = requireUser(request); const id = url.pathname.slice("/api/ai/memory/".length);
    if (!id || !deleteAIMemory(user.id, id)) return json(response, 404, { error: "记忆不存在" });
    return json(response, 200, { success: true });
  }
  if (url.pathname === "/api/ai/conversations" && request.method === "GET") {
    const { user } = requireUser(request);
    const conversationId = normalizeConversationId(url.searchParams.get("conversation_id"));
    const limit = normalizeConversationLimit(url.searchParams.get("limit"));
    return json(response, 200, { conversationId, messages: listAIConversation(user.id, conversationId, limit) });
  }
  if (url.pathname === "/api/ai/conversations" && request.method === "POST") {
    const { user } = requireUser(request); const body = await readBody(request);
    const conversationId = normalizeConversationId(body.conversation_id);
    const result = await createConversationReply(user.id, conversationId, body.message);
    return json(response, 201, { success: true, conversationId, reply: result.reply, messages: result.messages });
  }
  if (url.pathname.startsWith("/api/ai/conversations/") && request.method === "DELETE") {
    const { user } = requireUser(request);
    const conversationId = normalizeConversationId(url.pathname.slice("/api/ai/conversations/".length));
    return json(response, 200, { success: true, conversationId, deleted: deleteAIConversation(user.id, conversationId) });
  }
  if (url.pathname === "/api/ai/chat" && request.method === "POST") {
    const { user } = requireUser(request); const body = await readBody(request);
    const result = await createConversationReply(user.id, normalizeConversationId(body.conversation_id), body.message);
    return json(response, 200, { success: true, reply: result.reply });
  }
  if (url.pathname === "/api/ai/insights/today" && request.method === "GET") {
    const { user } = requireUser(request); const insightDate = shanghaiDate();
    return json(response, 200, { insight: getAIDailyInsight(user.id, insightDate) });
  }
  if (url.pathname === "/api/ai/insights/today" && request.method === "POST") {
    const { user } = requireUser(request); requireAIContextAuthorization(user.id);
    const insightDate = shanghaiDate();
    const existing = getAIDailyInsight(user.id, insightDate);
    if (existing) return json(response, 200, { insight: existing, cached: true });
    await enforceLocalAIQuota(user.id);
    const { data } = getWorkspace(user.id);
    const result = await generateAIResponse({ userId: user.id, message: dailyInsightPrompt(), context: buildAIContext(data, new Date(), listAIMemories(user.id, 60)), apiKey: process.env.DEEPSEEK_API_KEY, endpoint: process.env.DEEPSEEK_API_ENDPOINT, timeoutMs: DEEPSEEK_INSIGHT_TIMEOUT_MS });
    let saved;
    try { saved = saveAIDailyInsight(user.id, insightDate, parseDailyInsight(result.content)); }
    catch { throw Object.assign(new Error("AI 洞察已生成，但数据库保存失败，请重试"), { status: 503, code: "D1_SAVE_FAILED" }); }
    return json(response, saved.created ? 201 : 200, { insight: saved.insight, cached: !saved.created });
  }
  if (url.pathname === "/api/ai/insights" && request.method === "POST") {
    const { user } = requireUser(request); const body = await readBody(request);
    normalizeAIRequest(body);
    await enforceLocalAIQuota(user.id);
    const { data } = getWorkspace(user.id);
    const insight = await generateAIReport({ body, workspace: data, apiKey: process.env.DEEPSEEK_API_KEY, endpoint: process.env.DEEPSEEK_API_ENDPOINT });
    return json(response, 201, { insight: saveAIReport(user.id, insight) });
  }
  if (url.pathname === "/api/ai/reports" && request.method === "GET") return json(response, 200, { reports: listAIReports(requireUser(request).user.id) });
  if (url.pathname === "/api/preferences" && request.method === "GET") return json(response, 200, getPreferences(requireUser(request).user.id));
  if (url.pathname === "/api/preferences" && request.method === "PUT") {
    const { user } = requireUser(request); const body = await readBody(request);
    if (!body.themeId || !Array.isArray(body.customThemes)) return json(response, 422, { error: "主题配置无效" });
    return json(response, 200, savePreferences(user.id, { themeId: body.themeId, customThemes: body.customThemes }));
  }
  return json(response, 404, { error: "接口不存在" });
}

const server = http.createServer((request, response) => route(request, response).catch((error) => {
  console.error(error);
  const headers = error.status === 429 && error.retryAfter ? { "retry-after": String(error.retryAfter) } : {};
  json(response, error.status || 500, { error: error.status ? error.message : "服务暂时不可用", ...(error.code ? { code: error.code } : {}) }, headers);
}));

server.listen(port, "127.0.0.1", () => console.log(`Dazzjun API listening on http://127.0.0.1:${port}`));
