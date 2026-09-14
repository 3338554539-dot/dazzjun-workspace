import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultPreferences, emptyWorkspace, normalizeWorkspaceForStorage } from "./defaults.mjs";
import { dailyInspirationOffset, dailyInspirationResponse } from "../worker/inspiration/daily.js";
import { RATE_LIMIT_DEFAULTS, rateLimitWindow } from "../worker/security/rate-limit.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DAZZJUN_DATA_DIR ? path.resolve(process.env.DAZZJUN_DATA_DIR) : path.join(root, ".data");
mkdirSync(dataDir, { recursive: true });
const databasePath = process.env.DAZZJUN_DATABASE_PATH ? path.resolve(process.env.DAZZJUN_DATABASE_PATH) : path.join(dataDir, "dazzjun.sqlite");
const database = new DatabaseSync(databasePath);
database.exec(readFileSync(path.join(root, "database", "schema.sql"), "utf8"));
const learningAssetColumns = new Set(database.prepare("PRAGMA table_info(learning_assets)").all().map((column) => column.name));
if (!learningAssetColumns.has("status")) database.exec("ALTER TABLE learning_assets ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','uploaded','attached'))");
if (!learningAssetColumns.has("attached_at")) database.exec("ALTER TABLE learning_assets ADD COLUMN attached_at TEXT");

const consumeRateLimitSql = `
  INSERT INTO rate_limit_buckets(key,scope,window_start,count,updated_at)
  VALUES(?,?,?,1,?)
  ON CONFLICT(scope,key) DO UPDATE SET
    window_start=excluded.window_start,
    count=CASE WHEN rate_limit_buckets.window_start=excluded.window_start THEN rate_limit_buckets.count+1 ELSE 1 END,
    updated_at=excluded.updated_at
  WHERE rate_limit_buckets.window_start<>excluded.window_start OR rate_limit_buckets.count<?
`;

const userProjection = `id, email, phone, display_name AS displayName, bio, avatar_url AS avatarUrl, created_at AS createdAt, updated_at AS updatedAt`;

export function findUserByEmail(email) {
  return database.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

export function findUserById(id) {
  return database.prepare(`SELECT ${userProjection} FROM users WHERE id = ?`).get(id);
}

export function createUser({ email, passwordHash, passwordSalt, displayName }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("INSERT INTO users (id,email,password_hash,password_salt,display_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(id, email, passwordHash, passwordSalt, displayName, now, now);
    database.prepare("INSERT INTO profiles (user_id,display_name,bio,created_at,updated_at) VALUES (?,?,?,?,?)").run(id, displayName, "", now, now);
    database.prepare("INSERT INTO user_workspaces (user_id,payload_json,version,updated_at) VALUES (?,?,1,?)").run(id, JSON.stringify(emptyWorkspace), now);
    database.prepare("INSERT INTO themes (id,user_id,theme_id,palette_json,settings_json,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)").run(randomUUID(), id, "cosmic", "{}", JSON.stringify(defaultPreferences), now, now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return findUserById(id);
}

export function updateUserProfile(userId, patch) {
  const current = findUserById(userId);
  if (!current) return undefined;
  const now = new Date().toISOString();
  database.prepare("UPDATE users SET display_name = ?, bio = ?, avatar_url = ?, updated_at = ? WHERE id = ?").run(patch.displayName ?? current.displayName, patch.bio ?? current.bio, patch.avatarUrl ?? current.avatarUrl ?? null, now, userId);
  database.prepare("INSERT INTO profiles (user_id,display_name,bio,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,bio=excluded.bio,avatar_url=excluded.avatar_url,updated_at=excluded.updated_at").run(userId, patch.displayName ?? current.displayName, patch.bio ?? current.bio, patch.avatarUrl ?? current.avatarUrl ?? null, current.createdAt, now);
  return findUserById(userId);
}

export function updatePassword(userId, passwordHash, passwordSalt) {
  database.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?").run(passwordHash, passwordSalt, new Date().toISOString(), userId);
}

export function createSession(userId, tokenHash, expiresAt) {
  const now = new Date().toISOString();
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  database.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(randomUUID(), userId, tokenHash, expiresAt, now);
}

export function findSessionUser(tokenHash) {
  const now = new Date().toISOString();
  return database.prepare(`SELECT u.${userProjection.replaceAll(", ", ", u.")} FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`).get(tokenHash, now);
}

export function deleteSession(tokenHash) {
  database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteUserSessions(userId) {
  database.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function getPasswordRecord(userId) {
  return database.prepare("SELECT password_hash AS passwordHash, password_salt AS passwordSalt FROM users WHERE id = ?").get(userId);
}

export function checkRateLimitBucket(config, key, nowMs = Date.now()) {
  const { windowStart, retryAfter } = rateLimitWindow(config, nowMs);
  const row = database.prepare("SELECT count FROM rate_limit_buckets WHERE scope=? AND key=? AND window_start=?").get(config.scope, key, windowStart);
  return { allowed: Number(row?.count || 0) < config.limit, retryAfter };
}

export function consumeRateLimitBucket(config, key, nowMs = Date.now()) {
  const { windowStart, retryAfter } = rateLimitWindow(config, nowMs);
  const result = database.prepare(consumeRateLimitSql).run(key, config.scope, windowStart, new Date(nowMs).toISOString(), config.limit);
  return { allowed: result.changes === 1, retryAfter };
}

export function clearRateLimitBuckets(entries) {
  if (!entries.length) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    const statement = database.prepare("DELETE FROM rate_limit_buckets WHERE scope=? AND key=?");
    for (const entry of entries) statement.run(entry.scope, entry.key);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function maybeCleanupRateLimitBuckets(seedKey, nowMs = Date.now()) {
  const minute = Math.floor(nowMs / 60_000);
  const sample = Number.parseInt(String(seedKey || "00").slice(0, 2), 16) || 0;
  if ((sample + minute) % 64 !== 0) return;
  database.prepare("DELETE FROM rate_limit_buckets WHERE updated_at<?")
    .run(new Date(nowMs - RATE_LIMIT_DEFAULTS.retentionSeconds * 1000).toISOString());
}

export function getWorkspace(userId) {
  const row = database.prepare("SELECT payload_json AS payload, version, updated_at AS updatedAt FROM user_workspaces WHERE user_id = ?").get(userId);
  return row ? { data: JSON.parse(row.payload), version: row.version, updatedAt: row.updatedAt } : { data: structuredClone(emptyWorkspace), version: 1, updatedAt: new Date().toISOString() };
}

export function getDailyInspiration(userId, date) {
  const count = Number(database.prepare("SELECT COUNT(*) AS count FROM inspirations WHERE user_id = ?").get(userId)?.count || 0);
  if (!count) return null;
  const offset = dailyInspirationOffset(userId, date, count);
  const row = database.prepare("SELECT id,title,content,cover,image,category_name AS categoryName,author,platform,url,ai_tags AS aiTags FROM inspirations WHERE user_id = ? ORDER BY created_at DESC,id ASC LIMIT 1 OFFSET ?").get(userId, offset);
  return dailyInspirationResponse(row, userId);
}

export function saveWorkspace(userId, data) {
  const now = new Date().toISOString();
  const normalized = normalizeWorkspaceForStorage(data);
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("INSERT INTO user_workspaces (user_id,payload_json,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET payload_json=excluded.payload_json, version=user_workspaces.version+1, updated_at=excluded.updated_at").run(userId, JSON.stringify(normalized), now);
    database.prepare("DELETE FROM inspirations WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM inspiration_categories WHERE user_id = ?").run(userId);
    for (const category of normalized.inspirationCategories) database.prepare("INSERT INTO inspiration_categories (id,user_id,name,icon,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`${userId}:${category.id}`, userId, category.name, category.icon, category.order, category.createdAt ?? now, now);
    for (const inspiration of normalized.inspirations) database.prepare("INSERT INTO inspirations (id,user_id,platform,content,url,image,category_id,title,cover,author,source_text,category_name,ai_tags,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(`${userId}:${inspiration.id}`, userId, inspiration.platform, inspiration.content, inspiration.url, inspiration.image || null, inspiration.categoryId ? `${userId}:${inspiration.categoryId}` : null, inspiration.title, inspiration.cover, inspiration.author, inspiration.sourceText, inspiration.categoryName, JSON.stringify(inspiration.aiTags), inspiration.createdAt ?? now, now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getWorkspace(userId);
}

export function createLearningAsset(userId, asset) {
  database.prepare("INSERT INTO learning_assets(id,user_id,learning_id,block_type,object_key,thumbnail_key,name,size,mime,status,attached_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,'pending',NULL,?)")
    .run(asset.id, userId, asset.learningId, asset.blockType, asset.objectKey, asset.thumbnailKey || null, asset.name, asset.size, asset.mime, asset.createdAt);
  return getLearningAsset(userId, asset.id);
}

export function getLearningAsset(userId, assetId) {
  return database.prepare("SELECT id,learning_id AS learningId,block_type AS blockType,object_key AS objectKey,thumbnail_key AS thumbnailKey,name,size,mime,status,attached_at AS attachedAt,created_at AS createdAt FROM learning_assets WHERE id=? AND user_id=?")
    .get(assetId, userId);
}

export function confirmLearningAssets(userId, learningId, assetIds) {
  const ids = [...new Set((Array.isArray(assetIds) ? assetIds : []).map((value) => String(value || "").trim()).filter((value) => /^[a-zA-Z0-9_-]{8,120}$/u.test(value)))];
  const safeLearningId = String(learningId || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,120}$/u.test(safeLearningId)) throw Object.assign(new Error("学习日志标识无效"), { status: 422 });
  if (!ids.length) return { success: true, learningId: safeLearningId, assets: [] };
  const entry = getWorkspace(userId).data.learning?.find((item) => String(item?.id || "") === safeLearningId);
  if (!entry) throw Object.assign(new Error("学习日志尚未写入服务端，附件不能确认"), { status: 409 });
  const referenced = new Set((Array.isArray(entry.learningBlocks) ? entry.learningBlocks : []).filter((block) => block?.type === "image" || block?.type === "file").map((block) => String(block.assetId || block.id || "")));
  if (ids.some((id) => !referenced.has(id))) throw Object.assign(new Error("附件与学习日志内容不一致"), { status: 409 });
  const attachedAt = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const id of ids) {
      const result = database.prepare("UPDATE learning_assets SET status='attached',attached_at=COALESCE(attached_at,?) WHERE id=? AND user_id=? AND learning_id=?").run(attachedAt, id, userId, safeLearningId);
      if (result.changes !== 1) throw Object.assign(new Error("部分附件不存在或不属于当前学习日志"), { status: 409 });
    }
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return { success: true, learningId: safeLearningId, assets: ids.map((id) => ({ id, status: "attached", attachedAt })) };
}

export function deleteLearningAsset(userId, assetId) {
  const asset = getLearningAsset(userId, assetId);
  if (!asset) return undefined;
  database.prepare("DELETE FROM learning_assets WHERE id=? AND user_id=?").run(assetId, userId);
  return asset;
}

export function saveAIReport(userId, insight) {
  const id = randomUUID();
  const now = new Date().toISOString();
  database.prepare("INSERT INTO ai_reports (id,user_id,type,payload_json,provider,model,prompt_tokens,completion_tokens,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, userId, insight.type, JSON.stringify({ ...insight, id }), insight.provider, insight.model, insight.usage?.promptTokens ?? 0, insight.usage?.completionTokens ?? 0, now);
  return { ...insight, id };
}

export function listAIReports(userId, limit = 30) {
  return database.prepare("SELECT payload_json AS payload FROM ai_reports WHERE user_id=? ORDER BY created_at DESC LIMIT ?").all(userId, Math.min(100, Math.max(1, limit))).map((row) => JSON.parse(row.payload));
}

export function listAIMemories(userId, limit = 200) {
  return database.prepare("SELECT id,memory_type AS memoryType,content,importance,source,created_at AS createdAt,updated_at AS updatedAt FROM ai_memory WHERE user_id=? ORDER BY importance DESC,updated_at DESC LIMIT ?")
    .all(userId, Math.min(200, Math.max(1, limit)))
    .map((row) => ({ ...row }));
}

export function createAIMemory(userId, memory) {
  const id = randomUUID();
  const now = new Date().toISOString();
  database.prepare("INSERT INTO ai_memory(id,user_id,memory_type,content,importance,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(id, userId, memory.memoryType, memory.content, memory.importance, memory.source, now, now);
  return { id, ...memory, createdAt: now, updatedAt: now };
}

export function deleteAIMemory(userId, id) {
  return database.prepare("DELETE FROM ai_memory WHERE id=? AND user_id=?").run(id, userId).changes > 0;
}

export function getAIContextAuthorization(userId) {
  const query = database.prepare("SELECT authorized,authorized_at AS authorizedAt,updated_at AS updatedAt FROM ai_context_authorizations WHERE user_id=?");
  let row = query.get(userId);
  if (!row) {
    const now = new Date().toISOString();
    database.prepare("INSERT OR IGNORE INTO ai_context_authorizations(user_id,authorized,authorized_at,updated_at) VALUES(?,1,?,?)").run(userId, now, now);
    row = query.get(userId);
  }
  return { authorized: row.authorized === 1, authorizedAt: row.authorizedAt, updatedAt: row.updatedAt };
}

export function setAIContextAuthorization(userId, authorized) {
  const current = getAIContextAuthorization(userId);
  const now = new Date().toISOString();
  const authorizedAt = authorized ? current.authorizedAt || now : null;
  database.prepare("INSERT INTO ai_context_authorizations(user_id,authorized,authorized_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET authorized=excluded.authorized,authorized_at=excluded.authorized_at,updated_at=excluded.updated_at")
    .run(userId, authorized ? 1 : 0, authorizedAt, now);
  return { authorized, authorizedAt, updatedAt: now };
}

export function listAIConversation(userId, conversationId, limit) {
  return database.prepare("SELECT id,conversation_id AS conversationId,role,content,created_at AS createdAt FROM (SELECT id,conversation_id,role,content,created_at FROM ai_conversations WHERE user_id=? AND conversation_id=? ORDER BY created_at DESC,id DESC LIMIT ?) ORDER BY created_at ASC,id ASC")
    .all(userId, conversationId, limit)
    .map((row) => ({ ...row }));
}

export function saveAIConversationExchange(userId, messages) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const message of messages) {
      database.prepare("INSERT INTO ai_conversations(id,conversation_id,user_id,role,content,created_at) VALUES(?,?,?,?,?,?)")
        .run(message.id, message.conversationId, userId, message.role, message.content, message.createdAt);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return messages;
}

export function deleteAIConversation(userId, conversationId) {
  return database.prepare("DELETE FROM ai_conversations WHERE user_id=? AND conversation_id=?").run(userId, conversationId).changes;
}

export function getAIDailyInsight(userId, insightDate) {
  const row = database.prepare("SELECT id,insight_date AS insightDate,summary,status_analysis AS statusAnalysis,growth_advice AS growthAdvice,generated_at AS generatedAt FROM ai_insights WHERE user_id=? AND insight_date=?").get(userId, insightDate);
  return row ? { ...row } : null;
}

export function saveAIDailyInsight(userId, insightDate, insight) {
  const id = randomUUID();
  const generatedAt = new Date().toISOString();
  const result = database.prepare("INSERT OR IGNORE INTO ai_insights(id,user_id,insight_date,summary,status_analysis,growth_advice,generated_at) VALUES(?,?,?,?,?,?,?)")
    .run(id, userId, insightDate, insight.summary, insight.statusAnalysis, insight.growthAdvice, generatedAt);
  return { insight: getAIDailyInsight(userId, insightDate), created: result.changes > 0 };
}

export function getPreferences(userId) {
  const row = database.prepare("SELECT settings_json AS settings, updated_at AS updatedAt FROM themes WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1").get(userId);
  return { ...defaultPreferences, ...(row ? JSON.parse(row.settings) : {}), updatedAt: row?.updatedAt ?? new Date().toISOString() };
}

export function savePreferences(userId, preferences) {
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE themes SET is_active = 0 WHERE user_id = ?").run(userId);
    database.prepare("INSERT INTO themes (id,user_id,theme_id,wallpaper,palette_json,settings_json,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)").run(randomUUID(), userId, preferences.themeId, null, "{}", JSON.stringify(preferences), now, now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { ...preferences, updatedAt: now };
}

export function databaseInfo() {
  return { databasePath, exists: existsSync(databasePath) };
}
