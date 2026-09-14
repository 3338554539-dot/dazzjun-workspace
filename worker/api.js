import { generateAIReport, normalizeAIRequest } from "./ai/report-service.js";
import { testDeepSeekConnection } from "./ai/providers/deepseek.js";
import { generateAIResponse, validateAIMessage } from "./ai/chat-runtime/service.js";
import { DEEPSEEK_CHAT_TIMEOUT_MS, DEEPSEEK_INSIGHT_TIMEOUT_MS } from "./ai/chat-runtime/deepseek.js";
import { loadAIContext } from "./ai/chat-runtime/context.js";
import { createAIMemory, deleteAIMemory, listAIMemories } from "./ai/chat-runtime/memory.js";
import { conversationMessages, dailyInsightPrompt, normalizeConversationId, normalizeConversationLimit, parseDailyInsight, shanghaiDate } from "./ai/persistence.js";
import { captureInspiration } from "./inspiration/capture.js";
import { dailyInspirationOffset, dailyInspirationResponse } from "./inspiration/daily.js";
import { confirmLearningAssets, deleteLearningAsset, getLearningAsset, uploadLearningAsset } from "./learning/assets.js";
import { normalizeLearningEntries } from "./learning/blocks.js";
import { previewLearningLink } from "./learning/link-preview.js";
import { checkD1RateLimit, clearD1RateLimits, clientAddress, consumeOrThrow, enforceAIQuota, rateLimitConfig } from "./security/rate-limit.js";

const SESSION_SECONDS = 30 * 86400;
const ITERATIONS = 100_000;
const encoder = new TextEncoder();
const apiRoutes = new Set(["/api/health", "/api/auth/register", "/api/auth/login", "/api/auth/session", "/api/auth/logout", "/api/auth/profile", "/api/auth/password", "/api/workspace", "/api/preferences", "/api/inspiration/capture", "/api/inspiration/random", "/api/learning/assets", "/api/learning/assets/confirm", "/api/learning/link-preview", "/api/ai/status", "/api/ai/test", "/api/ai/chat", "/api/ai/context-authorization", "/api/ai/conversations", "/api/ai/memory", "/api/ai/insights", "/api/ai/insights/today", "/api/ai/reports"]);
const emptyWorkspace = {
  todos: [], moods: [], learning: [], english: [], fitness: [], weeklyReviews: [], inspirations: [], inspirationNotes: [],
  inspirationCategories: [],
  inspirationTags: ["创意", "设计", "写作", "商业", "AI", "学习", "金句", "生活"], habitCompletions: [], inspirationLinks: [],
  aiInsights: [], knowledgeLinks: [], memories: [], usageEvents: [], aiNotifications: [],
  goals: { weeklyTodoTarget: 10, weeklyLearningMinutes: 300, weeklyEnglishMinutes: 280, weeklyFitnessSessions: 4, monthlyInspirationTarget: 30 },
};
const legacyPresetCategoryIds = new Set(["design", "ai", "photography", "fashion", "music", "business"]);
const cleanCategoryName = (value) => String(value || "").trim().replace(/^[。、\s]+|[。、\s]+$/g, "").trim();
const normalizeInspirationPlatform = (value) => value === "douyin" || value === "抖音" ? "douyin" : value === "xiaohongshu" || value === "小红书" ? "xiaohongshu" : "web";
const portalForPlatform = (platform) => platform === "xiaohongshu" ? "小红书" : "抖音";
const cleanTags = (value) => Array.isArray(value) ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12) : [];
const inspirationCoverTypes = new Set(["video_first_frame", "video_poster", "first_image", "og_image", "main_image", "fallback"]);

function normalizeWorkspaceForStorage(input) {
  const categories = (Array.isArray(input?.inspirationCategories) ? input.inspirationCategories : [])
    .filter((item) => item?.id && !legacyPresetCategoryIds.has(String(item.id)))
    .map((item, index) => ({ id: String(item.id), name: cleanCategoryName(item.name), icon: String(item.icon || ""), order: Number.isFinite(item.order) ? item.order : index, createdAt: item.createdAt || new Date().toISOString() }))
    .filter((item) => item.name)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase()) === index)
    .sort((a, b) => a.order - b.order)
    .map((item, order) => ({ ...item, order }));
  const categoriesById = new Map(categories.map((item) => [item.id, item]));
  const inspirations = (Array.isArray(input?.inspirations) ? input.inspirations : []).map((item) => {
    const platform = normalizeInspirationPlatform(item.platform);
    const categoryId = categoriesById.has(String(item.categoryId || "")) ? String(item.categoryId) : "";
    const title = String(item.title || item.content || "收藏内容").trim() || "收藏内容";
    const cover = String(item.cover || item.image || "");
    return {
      ...item,
      platform,
      portal: item.portal === "小红书" || item.portal === "抖音" ? item.portal : portalForPlatform(platform),
      title,
      content: title,
      cover,
      image: cover,
      coverSource: String(item.coverSource || ""),
      ...(inspirationCoverTypes.has(item.coverType) ? { coverType: item.coverType } : {}),
      author: String(item.author || ""),
      sourceText: String(item.sourceText || item.source_text || ""),
      categoryId,
      categoryName: categoriesById.get(categoryId)?.name || "",
      aiTags: cleanTags(item.aiTags || item.ai_tags),
      url: String(item.url || ""),
      createdAt: String(item.createdAt || new Date().toISOString()),
      saved: item.saved !== false,
    };
  });
  return { ...structuredClone(emptyWorkspace), ...input, learning: normalizeLearningEntries(input?.learning), inspirationCategories: categories, inspirations };
}

const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const randomToken = (size = 32) => { const bytes = new Uint8Array(size); crypto.getRandomValues(bytes); return base64url(bytes); };
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const cookie = (token, maxAge = SESSION_SECONDS) => `dazzjun_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
const cookies = (request) => Object.fromEntries((request.headers.get("cookie") || "").split(";").map((part) => part.trim().split("=")).filter(([key]) => key).map(([key, value]) => [key, decodeURIComponent(value || "")]));

async function passwordHash(password, salt = randomToken(18)) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: ITERATIONS }, key, 256);
  return { salt, hash: base64url(bits) };
}

async function tokenHash(token) {
  return base64url(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}

function timingSafeEqual(left, right) {
  const a = encoder.encode(String(left || ""));
  const b = encoder.encode(String(right || ""));
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

async function readBody(request) {
  if (Number(request.headers.get("content-length") || 0) > 16 * 1024 * 1024) throw Object.assign(new Error("请求内容过大"), { status: 413 });
  try { return await request.json(); } catch { throw Object.assign(new Error("JSON 格式无效"), { status: 400 }); }
}

const publicUser = (row) => row && ({ id: row.id, email: row.email, phone: row.phone ?? null, displayName: row.displayName, bio: row.bio || "", avatarUrl: row.avatarUrl ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt });
const userSelect = "id,email,phone,display_name AS displayName,bio,avatar_url AS avatarUrl,created_at AS createdAt,updated_at AS updatedAt";

async function sessionFor(request, db) {
  const token = cookies(request).dazzjun_session;
  if (!token) return {};
  const hash = await tokenHash(token);
  const user = await db.prepare(`SELECT u.${userSelect.replaceAll(",", ",u.")} FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(hash, new Date().toISOString()).first();
  return { token, hash, user };
}

async function requireUser(request, db) {
  const session = await sessionFor(request, db);
  if (!session.user) throw Object.assign(new Error("请先登录"), { status: 401 });
  return session;
}

async function issueSession(db, userId) {
  const token = randomToken(); const hash = await tokenHash(token); const now = new Date().toISOString(); const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now),
    db.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), userId, hash, expires, now),
  ]);
  return token;
}

async function getAIContextAuthorization(db, userId) {
  const query = "SELECT authorized,authorized_at AS authorizedAt,updated_at AS updatedAt FROM ai_context_authorizations WHERE user_id=?";
  let row = await db.prepare(query).bind(userId).first();
  if (!row) {
    const now = new Date().toISOString();
    await db.prepare("INSERT OR IGNORE INTO ai_context_authorizations(user_id,authorized,authorized_at,updated_at) VALUES(?,1,?,?)").bind(userId, now, now).run();
    row = await db.prepare(query).bind(userId).first();
  }
  return { authorized: row.authorized === 1, authorizedAt: row.authorizedAt, updatedAt: row.updatedAt };
}

async function setAIContextAuthorization(db, userId, authorized) {
  const current = await getAIContextAuthorization(db, userId);
  const now = new Date().toISOString();
  const authorizedAt = authorized ? current.authorizedAt || now : null;
  await db.prepare("INSERT INTO ai_context_authorizations(user_id,authorized,authorized_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET authorized=excluded.authorized,authorized_at=excluded.authorized_at,updated_at=excluded.updated_at")
    .bind(userId, authorized ? 1 : 0, authorizedAt, now).run();
  return { authorized, authorizedAt, updatedAt: now };
}

async function requireAIContextAuthorization(db, userId) {
  const authorization = await getAIContextAuthorization(db, userId);
  if (!authorization.authorized) throw Object.assign(new Error("请先授权 Dazzjun AI 使用个人数据"), { status: 403 });
  return authorization;
}

async function listAIConversation(db, userId, conversationId, limit) {
  const rows = await db.prepare("SELECT id,conversation_id AS conversationId,role,content,created_at AS createdAt FROM (SELECT id,conversation_id,role,content,created_at FROM ai_conversations WHERE user_id=? AND conversation_id=? ORDER BY created_at DESC,id DESC LIMIT ?) ORDER BY created_at ASC,id ASC")
    .bind(userId, conversationId, limit).all();
  return rows.results || [];
}

async function createConversationReply(db, env, userId, conversationId, message) {
  await requireAIContextAuthorization(db, userId);
  validateAIMessage(message);
  await enforceAIQuota(db, env, userId);
  const userCreatedAt = new Date().toISOString();
  const context = await loadAIContext({ db, userId });
  const result = await generateAIResponse({ userId, message, context, apiKey: env.DEEPSEEK_API_KEY, timeoutMs: DEEPSEEK_CHAT_TIMEOUT_MS });
  const assistantCreatedAt = new Date(Math.max(Date.now(), new Date(userCreatedAt).getTime() + 1)).toISOString();
  const messages = conversationMessages({
    conversationId,
    message,
    reply: result.content,
    userCreatedAt,
    assistantCreatedAt,
    ids: { user: crypto.randomUUID(), assistant: crypto.randomUUID() },
  });
  try {
    await db.batch(messages.map((item) => db.prepare("INSERT INTO ai_conversations(id,conversation_id,user_id,role,content,created_at) VALUES(?,?,?,?,?,?)")
      .bind(item.id, item.conversationId, userId, item.role, item.content, item.createdAt)));
  } catch {
    throw Object.assign(new Error("AI 回复已生成，但 D1 对话保存失败，请重试"), { status: 503, code: "D1_SAVE_FAILED" });
  }
  return { reply: result.content, messages };
}

async function getAIDailyInsight(db, userId, insightDate) {
  return await db.prepare("SELECT id,insight_date AS insightDate,summary,status_analysis AS statusAnalysis,growth_advice AS growthAdvice,generated_at AS generatedAt FROM ai_insights WHERE user_id=? AND insight_date=?")
    .bind(userId, insightDate).first() || null;
}

async function saveAIDailyInsight(db, userId, insightDate, insight) {
  try {
    const id = crypto.randomUUID(); const generatedAt = new Date().toISOString();
    const result = await db.prepare("INSERT OR IGNORE INTO ai_insights(id,user_id,insight_date,summary,status_analysis,growth_advice,generated_at) VALUES(?,?,?,?,?,?,?)")
      .bind(id, userId, insightDate, insight.summary, insight.statusAnalysis, insight.growthAdvice, generatedAt).run();
    return { insight: await getAIDailyInsight(db, userId, insightDate), created: Number(result.meta?.changes || 0) > 0 };
  } catch {
    throw Object.assign(new Error("AI 洞察已生成，但 D1 保存失败，请重试"), { status: 503, code: "D1_SAVE_FAILED" });
  }
}

export const isApiRoute = (pathname) => apiRoutes.has(pathname) || /^\/api\/ai\/(?:memory|conversations)\/[^/]+$/.test(pathname) || /^\/api\/learning\/assets\/[^/]+$/.test(pathname);

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health" && request.method === "GET") {
    const connected = Boolean(env.DB);
    return json({ status: connected ? "ok" : "degraded", runtime: "cloudflare-worker", database: connected ? "connected" : "unavailable", timestamp: new Date().toISOString() }, connected ? 200 : 503);
  }
  const db = env.DB;
  if (!db) return json({ error: "数据库尚未绑定，请在生产环境配置 DB" }, 503);
  try {
    if (mutationMethods.has(request.method) && request.headers.get("origin") && request.headers.get("origin") !== url.origin) return json({ error: "请求来源无效" }, 403);

    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      const body = await readBody(request); const email = normalizeEmail(body.email); const password = String(body.password || ""); const displayName = String(body.displayName || "").trim();
      await consumeOrThrow(db, rateLimitConfig(env).registerIpRequests, clientAddress(request), "尝试次数过多，请稍后再试");
      if (!validEmail(email)) return json({ error: "请输入有效邮箱" }, 422);
      if (password.length < 8) return json({ error: "密码至少需要 8 位" }, 422);
      if (displayName.length < 2 || displayName.length > 30) return json({ error: "名称需要 2–30 个字符" }, 422);
      if (await db.prepare("SELECT id FROM users WHERE email=?").bind(email).first()) return json({ error: "这个邮箱已经注册" }, 409);
      const id = crypto.randomUUID(); const now = new Date().toISOString(); const credentials = await passwordHash(password);
      await db.batch([
        db.prepare("INSERT INTO users(id,email,password_hash,password_salt,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(id, email, credentials.hash, credentials.salt, displayName, now, now),
        db.prepare("INSERT INTO profiles(user_id,display_name,bio,created_at,updated_at) VALUES(?,?,?,?,?)").bind(id, displayName, "", now, now),
        db.prepare("INSERT INTO user_workspaces(user_id,payload_json,version,updated_at) VALUES(?,?,1,?)").bind(id, JSON.stringify(emptyWorkspace), now),
        db.prepare("INSERT INTO themes(id,user_id,theme_id,palette_json,settings_json,is_active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)").bind(crypto.randomUUID(), id, "cosmic", "{}", JSON.stringify({ themeId: "cosmic", customThemes: [] }), now, now),
      ]);
      const user = await db.prepare(`SELECT ${userSelect} FROM users WHERE id=?`).bind(id).first(); const token = await issueSession(db, id);
      return json({ user: publicUser(user) }, 201, { "set-cookie": cookie(token) });
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readBody(request); const email = normalizeEmail(body.email); const password = String(body.password || "");
      const config = rateLimitConfig(env); const address = clientAddress(request);
      await checkD1RateLimit(db, config.loginIpFailures, address, "尝试次数过多，请稍后再试");
      await checkD1RateLimit(db, config.loginAccountFailures, email, "尝试次数过多，请稍后再试");
      const record = await db.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
      const candidateHash = record ? (await passwordHash(password, record.password_salt)).hash : (await passwordHash(password, "missing-account-placeholder")).hash;
      const valid = Boolean(record) && timingSafeEqual(candidateHash, record?.password_hash);
      if (!valid) {
        await consumeOrThrow(db, config.loginIpFailures, address, "尝试次数过多，请稍后再试");
        await consumeOrThrow(db, config.loginAccountFailures, email, "尝试次数过多，请稍后再试");
        return json({ error: "邮箱或密码不正确" }, 401);
      }
      await clearD1RateLimits(db, [{ scope: config.loginAccountFailures.scope, identifier: email }]);
      const user = await db.prepare(`SELECT ${userSelect} FROM users WHERE id=?`).bind(record.id).first(); const token = await issueSession(db, record.id);
      return json({ user: publicUser(user) }, 200, { "set-cookie": cookie(token) });
    }

    if (url.pathname === "/api/auth/session" && request.method === "GET") {
      const { user } = await sessionFor(request, db); return user ? json({ user: publicUser(user) }) : json({ error: "未登录" }, 401);
    }
    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      const session = await sessionFor(request, db); if (session.hash) await db.prepare("DELETE FROM sessions WHERE token_hash=?").bind(session.hash).run();
      return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
    }
    if (url.pathname === "/api/auth/profile" && request.method === "PATCH") {
      const { user } = await requireUser(request, db); const body = await readBody(request); const displayName = String(body.displayName ?? user.displayName).trim(); const bio = String(body.bio ?? user.bio).trim();
      if (displayName.length < 2 || displayName.length > 30 || bio.length > 120) return json({ error: "请检查名称或签名长度" }, 422);
      const now = new Date().toISOString(); await db.prepare("UPDATE users SET display_name=?,bio=?,avatar_url=?,updated_at=? WHERE id=?").bind(displayName, bio, body.avatarUrl ?? user.avatarUrl ?? null, now, user.id).run();
      await db.prepare("INSERT INTO profiles(user_id,display_name,bio,avatar_url,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,bio=excluded.bio,avatar_url=excluded.avatar_url,updated_at=excluded.updated_at").bind(user.id, displayName, bio, body.avatarUrl ?? user.avatarUrl ?? null, user.createdAt, now).run();
      return json({ user: publicUser(await db.prepare(`SELECT ${userSelect} FROM users WHERE id=?`).bind(user.id).first()) });
    }
    if (url.pathname === "/api/auth/password" && request.method === "POST") {
      const { user } = await requireUser(request, db); const body = await readBody(request); const nextPassword = String(body.nextPassword || "");
      const record = await db.prepare("SELECT password_hash AS passwordHash,password_salt AS passwordSalt FROM users WHERE id=?").bind(user.id).first();
      if (!record || (await passwordHash(String(body.currentPassword || ""), record.passwordSalt)).hash !== record.passwordHash) return json({ error: "当前密码不正确" }, 401);
      if (nextPassword.length < 8) return json({ error: "新密码至少需要 8 位" }, 422);
      const credentials = await passwordHash(nextPassword); const now = new Date().toISOString();
      await db.batch([db.prepare("UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?").bind(credentials.hash, credentials.salt, now, user.id), db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id)]);
      const token = await issueSession(db, user.id); return json({ ok: true }, 200, { "set-cookie": cookie(token) });
    }

    if (url.pathname === "/api/workspace" && request.method === "GET") {
      const { user } = await requireUser(request, db); const row = await db.prepare("SELECT payload_json AS payload,version,updated_at AS updatedAt FROM user_workspaces WHERE user_id=?").bind(user.id).first();
      return json({ data: row ? JSON.parse(row.payload) : emptyWorkspace, version: row?.version ?? 1, updatedAt: row?.updatedAt ?? new Date().toISOString() });
    }
    if (url.pathname === "/api/workspace" && request.method === "PUT") {
      const { user } = await requireUser(request, db); const body = await readBody(request);
      if (!body.data || !Array.isArray(body.data.todos) || !Array.isArray(body.data.memories) || !Array.isArray(body.data.inspirationCategories) || !Array.isArray(body.data.inspirations)) return json({ error: "工作台数据结构无效" }, 422);
      const normalized = normalizeWorkspaceForStorage(body.data);
      const now = new Date().toISOString(); await db.batch([
        db.prepare("INSERT INTO user_workspaces(user_id,payload_json,version,updated_at) VALUES(?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET payload_json=excluded.payload_json,version=user_workspaces.version+1,updated_at=excluded.updated_at").bind(user.id, JSON.stringify(normalized), now),
        db.prepare("DELETE FROM inspirations WHERE user_id=?").bind(user.id),
        db.prepare("DELETE FROM inspiration_categories WHERE user_id=?").bind(user.id),
        ...normalized.inspirationCategories.map((category) => db.prepare("INSERT INTO inspiration_categories(id,user_id,name,icon,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(`${user.id}:${category.id}`, user.id, category.name, category.icon, category.order, category.createdAt ?? now, now)),
        ...normalized.inspirations.map((inspiration) => db.prepare("INSERT INTO inspirations(id,user_id,platform,content,url,image,category_id,title,cover,author,source_text,category_name,ai_tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(`${user.id}:${inspiration.id}`, user.id, inspiration.platform, inspiration.content, inspiration.url, inspiration.image || null, inspiration.categoryId ? `${user.id}:${inspiration.categoryId}` : null, inspiration.title, inspiration.cover, inspiration.author, inspiration.sourceText, inspiration.categoryName, JSON.stringify(inspiration.aiTags), inspiration.createdAt ?? now, now)),
      ]);
      return json({ ok: true, updatedAt: now });
    }
    if (url.pathname === "/api/inspiration/capture" && request.method === "POST") {
      await requireUser(request, db);
      const body = await readBody(request);
      return json(await captureInspiration({ url: body.url, sourceText: body.sourceText }));
    }
    if (url.pathname === "/api/inspiration/random" && request.method === "GET") {
      const { user } = await requireUser(request, db);
      const countRow = await db.prepare("SELECT COUNT(*) AS count FROM inspirations WHERE user_id=?").bind(user.id).first();
      const count = Number(countRow?.count || 0);
      if (!count) return json(null);
      const offset = dailyInspirationOffset(user.id, shanghaiDate(), count);
      const row = await db.prepare("SELECT id,title,content,cover,image,category_name AS categoryName,author,platform,url,ai_tags AS aiTags FROM inspirations WHERE user_id=? ORDER BY created_at DESC,id ASC LIMIT 1 OFFSET ?")
        .bind(user.id, offset).first();
      return json(dailyInspirationResponse(row, user.id));
    }
    if (url.pathname === "/api/learning/assets" && request.method === "POST") {
      const { user } = await requireUser(request, db);
      return json({ block: await uploadLearningAsset({ request, db, bucket: env.LEARNING_ASSETS, userId: user.id }) }, 201);
    }
    if (url.pathname === "/api/learning/assets/confirm" && request.method === "POST") {
      const { user } = await requireUser(request, db);
      const body = await readBody(request);
      return json(await confirmLearningAssets({ db, userId: user.id, learningId: body.learningId, assetIds: body.assetIds }));
    }
    if (url.pathname === "/api/learning/link-preview" && request.method === "POST") {
      await requireUser(request, db);
      const body = await readBody(request);
      return json({ block: await previewLearningLink(body.url) });
    }
    if (url.pathname.startsWith("/api/learning/assets/") && request.method === "GET") {
      const { user } = await requireUser(request, db);
      const assetId = decodeURIComponent(url.pathname.slice("/api/learning/assets/".length));
      return await getLearningAsset({ db, bucket: env.LEARNING_ASSETS, userId: user.id, assetId, thumbnail: url.searchParams.get("variant") === "thumbnail", download: url.searchParams.get("download") === "1" });
    }
    if (url.pathname.startsWith("/api/learning/assets/") && request.method === "DELETE") {
      const { user } = await requireUser(request, db);
      const assetId = decodeURIComponent(url.pathname.slice("/api/learning/assets/".length));
      return json(await deleteLearningAsset({ db, bucket: env.LEARNING_ASSETS, userId: user.id, assetId }));
    }
    if (url.pathname === "/api/ai/status" && request.method === "GET") {
      await requireUser(request, db);
      return json({ configured: Boolean(env.DEEPSEEK_API_KEY), provider: "DeepSeek", model: "deepseek-chat" });
    }
    if (url.pathname === "/api/ai/test" && request.method === "POST") {
      const { user } = await requireUser(request, db);
      await enforceAIQuota(db, env, user.id);
      return json(await testDeepSeekConnection({ apiKey: env.DEEPSEEK_API_KEY }));
    }
    if (url.pathname === "/api/ai/context-authorization" && request.method === "GET") {
      const { user } = await requireUser(request, db);
      return json(await getAIContextAuthorization(db, user.id));
    }
    if (url.pathname === "/api/ai/context-authorization" && request.method === "PUT") {
      const { user } = await requireUser(request, db); const body = await readBody(request);
      if (typeof body.authorized !== "boolean") return json({ error: "授权状态必须是布尔值" }, 422);
      return json(await setAIContextAuthorization(db, user.id, body.authorized));
    }
    if (url.pathname === "/api/ai/memory" && request.method === "GET") {
      const { user } = await requireUser(request, db);
      return json({ memories: await listAIMemories(db, user.id) });
    }
    if (url.pathname === "/api/ai/memory" && request.method === "POST") {
      const { user } = await requireUser(request, db); const body = await readBody(request);
      return json({ memory: await createAIMemory(db, user.id, { ...body, source: "user" }) }, 201);
    }
    if (url.pathname.startsWith("/api/ai/memory/") && request.method === "DELETE") {
      const { user } = await requireUser(request, db); const id = url.pathname.slice("/api/ai/memory/".length);
      if (!id || !await deleteAIMemory(db, user.id, id)) return json({ error: "记忆不存在" }, 404);
      return json({ success: true });
    }
    if (url.pathname === "/api/ai/conversations" && request.method === "GET") {
      const { user } = await requireUser(request, db);
      const conversationId = normalizeConversationId(url.searchParams.get("conversation_id"));
      const limit = normalizeConversationLimit(url.searchParams.get("limit"));
      return json({ conversationId, messages: await listAIConversation(db, user.id, conversationId, limit) });
    }
    if (url.pathname === "/api/ai/conversations" && request.method === "POST") {
      const { user } = await requireUser(request, db); const body = await readBody(request);
      const conversationId = normalizeConversationId(body.conversation_id);
      const result = await createConversationReply(db, env, user.id, conversationId, body.message);
      return json({ success: true, conversationId, reply: result.reply, messages: result.messages }, 201);
    }
    if (url.pathname.startsWith("/api/ai/conversations/") && request.method === "DELETE") {
      const { user } = await requireUser(request, db);
      const conversationId = normalizeConversationId(url.pathname.slice("/api/ai/conversations/".length));
      const result = await db.prepare("DELETE FROM ai_conversations WHERE user_id=? AND conversation_id=?").bind(user.id, conversationId).run();
      return json({ success: true, conversationId, deleted: Number(result.meta?.changes || 0) });
    }
    if (url.pathname === "/api/ai/chat" && request.method === "POST") {
      const { user } = await requireUser(request, db); const body = await readBody(request);
      const result = await createConversationReply(db, env, user.id, normalizeConversationId(body.conversation_id), body.message);
      return json({ success: true, reply: result.reply });
    }
    if (url.pathname === "/api/ai/insights/today" && request.method === "GET") {
      const { user } = await requireUser(request, db); const insightDate = shanghaiDate();
      return json({ insight: await getAIDailyInsight(db, user.id, insightDate) });
    }
    if (url.pathname === "/api/ai/insights/today" && request.method === "POST") {
      const { user } = await requireUser(request, db); await requireAIContextAuthorization(db, user.id);
      const insightDate = shanghaiDate();
      const existing = await getAIDailyInsight(db, user.id, insightDate);
      if (existing) return json({ insight: existing, cached: true });
      await enforceAIQuota(db, env, user.id);
      const context = await loadAIContext({ db, userId: user.id });
      const result = await generateAIResponse({ userId: user.id, message: dailyInsightPrompt(), context, apiKey: env.DEEPSEEK_API_KEY, timeoutMs: DEEPSEEK_INSIGHT_TIMEOUT_MS });
      const saved = await saveAIDailyInsight(db, user.id, insightDate, parseDailyInsight(result.content));
      return json({ insight: saved.insight, cached: !saved.created }, saved.created ? 201 : 200);
    }
    if (url.pathname === "/api/ai/insights" && request.method === "POST") {
      const { user } = await requireUser(request, db); const body = await readBody(request);
      normalizeAIRequest(body);
      await enforceAIQuota(db, env, user.id);
      const row = await db.prepare("SELECT payload_json AS payload FROM user_workspaces WHERE user_id=?").bind(user.id).first();
      const workspace = normalizeWorkspaceForStorage(row ? JSON.parse(row.payload) : emptyWorkspace);
      const insight = await generateAIReport({ body, workspace, apiKey: env.DEEPSEEK_API_KEY });
      const id = crypto.randomUUID(); const now = new Date().toISOString(); const stored = { ...insight, id };
      await db.prepare("INSERT INTO ai_reports(id,user_id,type,payload_json,provider,model,prompt_tokens,completion_tokens,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id, user.id, insight.type, JSON.stringify(stored), insight.provider, insight.model, insight.usage?.promptTokens ?? 0, insight.usage?.completionTokens ?? 0, now).run();
      return json({ insight: stored }, 201);
    }
    if (url.pathname === "/api/ai/reports" && request.method === "GET") {
      const { user } = await requireUser(request, db);
      const rows = await db.prepare("SELECT payload_json AS payload FROM ai_reports WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(user.id).all();
      return json({ reports: (rows.results || []).map((row) => JSON.parse(row.payload)) });
    }
    if (url.pathname === "/api/preferences" && request.method === "GET") {
      const { user } = await requireUser(request, db); const row = await db.prepare("SELECT settings_json AS settings,updated_at AS updatedAt FROM themes WHERE user_id=? AND is_active=1 ORDER BY updated_at DESC LIMIT 1").bind(user.id).first();
      return json({ themeId: "cosmic", customThemes: [], ...(row ? JSON.parse(row.settings) : {}), updatedAt: row?.updatedAt ?? new Date().toISOString() });
    }
    if (url.pathname === "/api/preferences" && request.method === "PUT") {
      const { user } = await requireUser(request, db); const body = await readBody(request);
      if (!body.themeId || !Array.isArray(body.customThemes)) return json({ error: "主题配置无效" }, 422);
      const now = new Date().toISOString(); await db.batch([
        db.prepare("UPDATE themes SET is_active=0 WHERE user_id=?").bind(user.id),
        db.prepare("INSERT INTO themes(id,user_id,theme_id,palette_json,settings_json,is_active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)").bind(crypto.randomUUID(), user.id, body.themeId, "{}", JSON.stringify({ themeId: body.themeId, customThemes: body.customThemes }), now, now),
      ]);
      return json({ ok: true, updatedAt: now });
    }
    return json({ error: "接口不存在" }, 404);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Worker API request failed", { status, code: String(error?.code || "INTERNAL_ERROR") });
    const headers = status === 429 && error.retryAfter ? { "retry-after": String(error.retryAfter) } : {};
    return json({ error: error.status ? error.message : "服务暂时不可用", ...(error.code ? { code: error.code } : {}) }, status, headers);
  }
}
