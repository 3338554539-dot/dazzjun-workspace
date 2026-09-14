import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { consumeD1RateLimit, RATE_LIMIT_DEFAULTS } from "../worker/security/rate-limit.js";

const root = path.resolve(import.meta.dirname, "..");

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForApi(baseUrl, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Local API exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Local API did not become ready");
}

async function startApi(databasePath, overrides = {}, endpoint = "http://127.0.0.1:9/chat") {
  const port = await freePort();
  const child = spawn(process.execPath, ["backend/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      DAZZJUN_API_PORT: String(port),
      DAZZJUN_DATABASE_PATH: databasePath,
      DEEPSEEK_API_KEY: "test-only-key",
      DEEPSEEK_API_ENDPOINT: endpoint,
      ...overrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForApi(baseUrl, child);
  return { baseUrl, child };
}

async function stopApi(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
}

async function request(baseUrl, pathname, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
}

const cookieFrom = (response) => response.headers.get("set-cookie")?.split(";")[0] || "";
const registerBody = (email) => ({ displayName: "Security Test", email, password: "TestPass123" });

test("rate limit migration is repeatable and preserves existing user data", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT NOT NULL)");
  database.prepare("INSERT INTO users(id,email) VALUES(?,?)").run("existing-user", "existing@example.test");
  const migration = await readFile(path.join(root, "database/migrations/0075_public_readiness_rate_limits.sql"), "utf8");
  database.exec(migration);
  database.exec(migration);
  assert.equal(database.prepare("SELECT email FROM users WHERE id=?").get("existing-user").email, "existing@example.test");
  assert.deepEqual(database.prepare("PRAGMA table_info(rate_limit_buckets)").all().map((column) => column.name), ["key", "scope", "window_start", "count", "updated_at"]);
  database.close();
});

test("D1 rate-limit keys are hashed and the atomic UPSERT denies over-limit increments", async () => {
  const buckets = new Map();
  let storedKey = "";
  const DB = {
    prepare: () => ({
      bind: (key, scope, windowStart, _updatedAt, limit) => ({
        run: async () => {
          storedKey = key;
          const id = `${scope}:${key}`;
          const current = buckets.get(id);
          if (current?.windowStart === windowStart && current.count >= limit) return { meta: { changes: 0 } };
          buckets.set(id, { windowStart, count: current?.windowStart === windowStart ? current.count + 1 : 1 });
          return { meta: { changes: 1 } };
        },
      }),
    }),
  };
  const identifier = "203.0.113.42";
  const config = { ...RATE_LIMIT_DEFAULTS.loginIpFailures, limit: 2 };
  assert.equal((await consumeD1RateLimit(DB, config, identifier, 1_800_000)).allowed, true);
  assert.equal((await consumeD1RateLimit(DB, config, identifier, 1_800_000)).allowed, true);
  assert.equal((await consumeD1RateLimit(DB, config, identifier, 1_800_000)).allowed, false);
  assert.notEqual(storedKey, identifier);
  assert.equal(storedKey.includes(identifier), false);
});

test("login failure limits survive restart and a successful login resets the account bucket", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dazzjun-auth-limit-"));
  const databasePath = path.join(directory, "test.sqlite");
  let api;
  try {
    api = await startApi(databasePath, { AUTH_LOGIN_IP_FAILURES: "10", AUTH_LOGIN_ACCOUNT_FAILURES: "3" });
    const registered = await request(api.baseUrl, "/api/auth/register", { method: "POST", body: registerBody("login-limit@example.test") });
    assert.equal(registered.response.status, 201);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const failed = await request(api.baseUrl, "/api/auth/login", { method: "POST", body: { email: "login-limit@example.test", password: "WrongPass123" } });
      assert.equal(failed.response.status, 401);
      assert.equal(failed.body.error, "邮箱或密码不正确");
    }
    const successful = await request(api.baseUrl, "/api/auth/login", { method: "POST", body: { email: "login-limit@example.test", password: "TestPass123" } });
    assert.equal(successful.response.status, 200);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const failed = await request(api.baseUrl, "/api/auth/login", { method: "POST", body: { email: "login-limit@example.test", password: "WrongPass123" } });
      assert.equal(failed.response.status, 401);
    }
    await stopApi(api.child);
    api = await startApi(databasePath, { AUTH_LOGIN_IP_FAILURES: "10", AUTH_LOGIN_ACCOUNT_FAILURES: "3" });
    const limited = await request(api.baseUrl, "/api/auth/login", { method: "POST", body: { email: "login-limit@example.test", password: "WrongPass123" } });
    assert.equal(limited.response.status, 429);
    assert.equal(limited.body.error, "尝试次数过多，请稍后再试");
    assert.ok(Number(limited.response.headers.get("retry-after")) > 0);
  } finally {
    if (api) await stopApi(api.child);
    await rm(directory, { recursive: true, force: true });
  }
});

test("registration IP limits survive restart", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dazzjun-register-limit-"));
  const databasePath = path.join(directory, "test.sqlite");
  let api;
  try {
    api = await startApi(databasePath, { AUTH_REGISTER_IP_REQUESTS: "2" });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const invalid = await request(api.baseUrl, "/api/auth/register", { method: "POST", body: { displayName: "X", email: "invalid", password: "short" } });
      assert.equal(invalid.response.status, 422);
    }
    await stopApi(api.child);
    api = await startApi(databasePath, { AUTH_REGISTER_IP_REQUESTS: "2" });
    const limited = await request(api.baseUrl, "/api/auth/register", { method: "POST", body: registerBody("blocked@example.test") });
    assert.equal(limited.response.status, 429);
    assert.ok(Number(limited.response.headers.get("retry-after")) > 0);
  } finally {
    if (api) await stopApi(api.child);
    await rm(directory, { recursive: true, force: true });
  }
});

test("AI minute quotas are authenticated, isolated by user and validate input first", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dazzjun-ai-minute-"));
  const databasePath = path.join(directory, "test.sqlite");
  const provider = http.createServer((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "测试回复" } }] }));
  });
  const providerPort = await freePort();
  await new Promise((resolve) => provider.listen(providerPort, "127.0.0.1", resolve));
  let api;
  try {
    api = await startApi(databasePath, { AI_REQUESTS_PER_MINUTE: "2", AI_REQUESTS_PER_DAY: "100" }, `http://127.0.0.1:${providerPort}/chat`);
    const anonymous = await request(api.baseUrl, "/api/ai/chat", { method: "POST", body: { message: "hello" } });
    assert.equal(anonymous.response.status, 401);

    const accountA = await request(api.baseUrl, "/api/auth/register", { method: "POST", body: registerBody("quota-a@example.test") });
    const accountB = await request(api.baseUrl, "/api/auth/register", { method: "POST", body: registerBody("quota-b@example.test") });
    const cookieA = cookieFrom(accountA.response);
    const cookieB = cookieFrom(accountB.response);
    const oversized = await request(api.baseUrl, "/api/ai/chat", { method: "POST", cookie: cookieA, body: { message: "x".repeat(4_001) } });
    assert.equal(oversized.response.status, 422);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const chat = await request(api.baseUrl, "/api/ai/chat", { method: "POST", cookie: cookieA, body: { message: `A-${attempt}` } });
      assert.equal(chat.response.status, 200);
    }
    const limited = await request(api.baseUrl, "/api/ai/chat", { method: "POST", cookie: cookieA, body: { message: "A-limited" } });
    assert.equal(limited.response.status, 429);
    assert.equal(limited.body.error, "请求太频繁，请稍后再试");
    assert.ok(Number(limited.response.headers.get("retry-after")) > 0);

    const isolated = await request(api.baseUrl, "/api/ai/chat", { method: "POST", cookie: cookieB, body: { message: "B-allowed" } });
    assert.equal(isolated.response.status, 200);
  } finally {
    if (api) await stopApi(api.child);
    await new Promise((resolve) => provider.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("AI daily quota returns the dedicated daily message", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dazzjun-ai-daily-"));
  const databasePath = path.join(directory, "test.sqlite");
  const provider = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "测试回复" } }] }));
  });
  const providerPort = await freePort();
  await new Promise((resolve) => provider.listen(providerPort, "127.0.0.1", resolve));
  let api;
  try {
    api = await startApi(databasePath, { AI_REQUESTS_PER_MINUTE: "100", AI_REQUESTS_PER_DAY: "2" }, `http://127.0.0.1:${providerPort}/chat`);
    const account = await request(api.baseUrl, "/api/auth/register", { method: "POST", body: registerBody("daily-quota@example.test") });
    const cookie = cookieFrom(account.response);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const chat = await request(api.baseUrl, "/api/ai/chat", { method: "POST", cookie, body: { message: `daily-${attempt}` } });
      assert.equal(chat.response.status, 200);
    }
    const limited = await request(api.baseUrl, "/api/ai/chat", { method: "POST", cookie, body: { message: "daily-limited" } });
    assert.equal(limited.response.status, 429);
    assert.equal(limited.body.error, "今天的 AI 使用额度已达到上限");
  } finally {
    if (api) await stopApi(api.child);
    await new Promise((resolve) => provider.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
