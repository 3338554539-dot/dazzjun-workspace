const encoder = new TextEncoder();

const boundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

export const RATE_LIMIT_DEFAULTS = Object.freeze({
  loginIpFailures: Object.freeze({ scope: "auth_login_ip", limit: 10, windowSeconds: 15 * 60 }),
  loginAccountFailures: Object.freeze({ scope: "auth_login_account", limit: 8, windowSeconds: 15 * 60 }),
  registerIpRequests: Object.freeze({ scope: "auth_register_ip", limit: 5, windowSeconds: 60 * 60 }),
  aiPerMinute: Object.freeze({ scope: "ai_user_minute", limit: 10, windowSeconds: 60 }),
  aiPerDay: Object.freeze({ scope: "ai_user_day", limit: 100, windowSeconds: 24 * 60 * 60, offsetSeconds: 8 * 60 * 60 }),
  retentionSeconds: 7 * 24 * 60 * 60,
});

export function rateLimitConfig(env = {}) {
  return {
    loginIpFailures: { ...RATE_LIMIT_DEFAULTS.loginIpFailures, limit: boundedInteger(env.AUTH_LOGIN_IP_FAILURES, RATE_LIMIT_DEFAULTS.loginIpFailures.limit, 1, 100) },
    loginAccountFailures: { ...RATE_LIMIT_DEFAULTS.loginAccountFailures, limit: boundedInteger(env.AUTH_LOGIN_ACCOUNT_FAILURES, RATE_LIMIT_DEFAULTS.loginAccountFailures.limit, 1, 100) },
    registerIpRequests: { ...RATE_LIMIT_DEFAULTS.registerIpRequests, limit: boundedInteger(env.AUTH_REGISTER_IP_REQUESTS, RATE_LIMIT_DEFAULTS.registerIpRequests.limit, 1, 100) },
    aiPerMinute: { ...RATE_LIMIT_DEFAULTS.aiPerMinute, limit: boundedInteger(env.AI_REQUESTS_PER_MINUTE, RATE_LIMIT_DEFAULTS.aiPerMinute.limit, 1, 100) },
    aiPerDay: { ...RATE_LIMIT_DEFAULTS.aiPerDay, limit: boundedInteger(env.AI_REQUESTS_PER_DAY, RATE_LIMIT_DEFAULTS.aiPerDay.limit, 1, 10_000) },
  };
}

const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

export async function hashRateLimitIdentifier(scope, identifier) {
  const value = `${String(scope || "unknown")}:${String(identifier || "unknown").trim().toLowerCase()}`;
  return base64url(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export function clientAddress(request) {
  return String(request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim() || "unknown";
}

export function rateLimitWindow(config, nowMs = Date.now()) {
  const nowSeconds = Math.floor(nowMs / 1000);
  const offset = Number(config.offsetSeconds || 0);
  const windowStart = Math.floor((nowSeconds + offset) / config.windowSeconds) * config.windowSeconds - offset;
  return { windowStart, retryAfter: Math.max(1, windowStart + config.windowSeconds - nowSeconds) };
}

export function rateLimitError(message, retryAfter) {
  return Object.assign(new Error(message), { status: 429, code: "RATE_LIMITED", retryAfter: Math.max(1, Math.ceil(Number(retryAfter) || 1)) });
}

const consumeSql = `
  INSERT INTO rate_limit_buckets(key,scope,window_start,count,updated_at)
  VALUES(?,?,?,1,?)
  ON CONFLICT(scope,key) DO UPDATE SET
    window_start=excluded.window_start,
    count=CASE WHEN rate_limit_buckets.window_start=excluded.window_start THEN rate_limit_buckets.count+1 ELSE 1 END,
    updated_at=excluded.updated_at
  WHERE rate_limit_buckets.window_start<>excluded.window_start OR rate_limit_buckets.count<?
`;

export async function consumeD1RateLimit(db, config, identifier, nowMs = Date.now()) {
  const key = await hashRateLimitIdentifier(config.scope, identifier);
  const { windowStart, retryAfter } = rateLimitWindow(config, nowMs);
  const result = await db.prepare(consumeSql).bind(key, config.scope, windowStart, new Date(nowMs).toISOString(), config.limit).run();
  return { allowed: Number(result.meta?.changes || 0) === 1, key, scope: config.scope, retryAfter, windowStart, limit: config.limit };
}

export async function checkD1RateLimit(db, config, identifier, message, nowMs = Date.now()) {
  const key = await hashRateLimitIdentifier(config.scope, identifier);
  const { windowStart, retryAfter } = rateLimitWindow(config, nowMs);
  const row = await db.prepare("SELECT count FROM rate_limit_buckets WHERE scope=? AND key=? AND window_start=?")
    .bind(config.scope, key, windowStart).first();
  if (Number(row?.count || 0) >= config.limit) throw rateLimitError(message, retryAfter);
  return { key, scope: config.scope, retryAfter, windowStart, limit: config.limit };
}

export async function clearD1RateLimits(db, entries) {
  if (!entries.length) return;
  const statements = [];
  for (const entry of entries) {
    const key = await hashRateLimitIdentifier(entry.scope, entry.identifier);
    statements.push(db.prepare("DELETE FROM rate_limit_buckets WHERE scope=? AND key=?").bind(entry.scope, key));
  }
  await db.batch(statements);
}

export async function maybeCleanupD1RateLimits(db, seedKey, nowMs = Date.now()) {
  const minute = Math.floor(nowMs / 60_000);
  const sample = Number.parseInt(String(seedKey || "00").slice(0, 2), 16) || 0;
  if ((sample + minute) % 64 !== 0) return;
  const cutoff = new Date(nowMs - RATE_LIMIT_DEFAULTS.retentionSeconds * 1000).toISOString();
  await db.prepare("DELETE FROM rate_limit_buckets WHERE updated_at<?").bind(cutoff).run();
}

export async function consumeOrThrow(db, config, identifier, message, nowMs = Date.now()) {
  const state = await consumeD1RateLimit(db, config, identifier, nowMs);
  if (!state.allowed) throw rateLimitError(message, state.retryAfter);
  try { await maybeCleanupD1RateLimits(db, state.key, nowMs); }
  catch (error) { console.warn("Rate-limit cleanup skipped", error); }
  return state;
}

export async function enforceAIQuota(db, env, userId, nowMs = Date.now()) {
  const config = rateLimitConfig(env);
  await consumeOrThrow(db, config.aiPerMinute, userId, "请求太频繁，请稍后再试", nowMs);
  await consumeOrThrow(db, config.aiPerDay, userId, "今天的 AI 使用额度已达到上限", nowMs);
}
