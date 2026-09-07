import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { shanghaiDate } from "../worker/ai/persistence.js";

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForApi(baseUrl, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("API did not become ready");
}

function sessionCookie(response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0] || "";
}

async function jsonRequest(baseUrl, pathname, { cookie, method = "GET", body, origin } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}), ...(origin ? { origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
}

test("registration, sessions and workspace data stay isolated per account", async () => {
  const aiContextDate = shanghaiDate();
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "dazzjun-v7-"));
  const port = await freePort();
  const mockPort = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const deepSeekRequests = [];
  const deepSeek = http.createServer(async (request, response) => {
    let raw = ""; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    deepSeekRequests.push({ authorization: request.headers.authorization, body });
    const serializedMessages = JSON.stringify(body.messages || []);
    if (serializedMessages.includes("触发失败")) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "provider failure" } }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    const content = body.response_format
      ? JSON.stringify({ title: "AI 周成长报告", summary: "这是基于当前账户数据生成的报告。", sections: [{ title: "成长变化", content: "保持稳定记录。" }, { title: "下周建议", content: "安排一个深度学习时段。" }] })
      : serializedMessages.includes("生成今日洞察")
        ? JSON.stringify({ summary: "今日节奏稳定。", statusAnalysis: "重点任务正在推进。", growthAdvice: "保留一个专注时段。" })
        : "当前账户聊天回复";
    response.end(JSON.stringify({ model: "deepseek-chat", choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 } }));
  });
  await new Promise((resolve) => deepSeek.listen(mockPort, "127.0.0.1", resolve));
  const child = spawn(process.execPath, ["backend/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, DAZZJUN_API_PORT: String(port), DAZZJUN_DATA_DIR: dataDir, DEEPSEEK_API_KEY: "test-only-key", DEEPSEEK_API_ENDPOINT: `http://127.0.0.1:${mockPort}/chat/completions` },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForApi(baseUrl, child);
    const anonymous = await jsonRequest(baseUrl, "/api/workspace");
    assert.equal(anonymous.response.status, 401);
    const anonymousCapture = await jsonRequest(baseUrl, "/api/inspiration/capture", { method: "POST", body: { sourceText: "https://v.douyin.com/example" } });
    assert.equal(anonymousCapture.response.status, 401);
    const crossOrigin = await jsonRequest(baseUrl, "/api/auth/register", {
      method: "POST",
      origin: "https://untrusted.example",
      body: { displayName: "Blocked", email: "blocked@example.test", password: "TestPass123" },
    });
    assert.equal(crossOrigin.response.status, 403);

    const accountA = await jsonRequest(baseUrl, "/api/auth/register", {
      method: "POST",
      body: { displayName: "Account A", email: "a@example.test", password: "TestPass123" },
    });
    assert.equal(accountA.response.status, 201);
    const cookieA = sessionCookie(accountA.response);

    const workspaceA = await jsonRequest(baseUrl, "/api/workspace", { cookie: cookieA });
    assert.deepEqual(workspaceA.body.data.inspirationCategories, []);
    workspaceA.body.data.todos.push({
      id: "a-only",
      title: "Only A can read this",
      category: "工作",
      priority: "高",
      scheduleDate: aiContextDate,
      startAt: `${aiContextDate}T09:00`,
      deadline: "2099-08-10T18:00",
      done: false,
      createdAt: "2026-07-31T08:00:00.000Z",
    });
    workspaceA.body.data.inspirationCategories.push(
      { id: "a-category", name: "。A 私有分类。", icon: "spark", order: 1, createdAt: new Date().toISOString() },
      { id: "a-first", name: "、第一分类、", order: 0, createdAt: new Date().toISOString() },
    );
    workspaceA.body.data.inspirations.push({ id: "a-inspiration", platform: "douyin", portal: "抖音", title: "A 私有灵感", cover: "https://cdn.example.test/a.jpg", author: "A 作者", sourceText: "A 的分享文本", categoryName: "A 私有分类", aiTags: ["镜头语言"], content: "A 私有灵感", url: "https://www.douyin.com/video/example", image: "https://cdn.example.test/a.jpg", categoryId: "a-category", createdAt: new Date().toISOString(), saved: true });
    workspaceA.body.data.memories.push({ id: "a-memory", kind: "Interest", title: "A 私有记忆", value: "只属于 A", source: "user", confidence: 100, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const savedA = await jsonRequest(baseUrl, "/api/workspace", { cookie: cookieA, method: "PUT", body: { data: workspaceA.body.data } });
    assert.equal(savedA.response.status, 200);
    const createdMemory = await jsonRequest(baseUrl, "/api/ai/memory", { cookie: cookieA, method: "POST", body: { userId: "forged-user", memoryType: "goal", content: "A 的独立长期目标", importance: 5 } });
    assert.equal(createdMemory.response.status, 201);
    assert.equal(createdMemory.body.memory.memoryType, "goal");
    const sanitizedA = await jsonRequest(baseUrl, "/api/workspace", { cookie: cookieA });
    assert.deepEqual(sanitizedA.body.data.inspirationCategories.map(({ name, order }) => ({ name, order })), [{ name: "第一分类", order: 0 }, { name: "A 私有分类", order: 1 }]);
    const themeA = await jsonRequest(baseUrl, "/api/preferences", { cookie: cookieA, method: "PUT", body: { themeId: "minimal", customThemes: [] } });
    assert.equal(themeA.response.status, 200);

    const accountB = await jsonRequest(baseUrl, "/api/auth/register", {
      method: "POST",
      body: { displayName: "Account B", email: "b@example.test", password: "TestPass123" },
    });
    assert.equal(accountB.response.status, 201);
    const workspaceB = await jsonRequest(baseUrl, "/api/workspace", { cookie: sessionCookie(accountB.response) });
    assert.deepEqual(workspaceB.body.data.todos, []);
    assert.deepEqual(workspaceB.body.data.inspirations, []);
    assert.deepEqual(workspaceB.body.data.memories, []);
    const memoriesB = await jsonRequest(baseUrl, "/api/ai/memory", { cookie: sessionCookie(accountB.response) });
    assert.deepEqual(memoriesB.body.memories, []);
    const crossAccountMemoryDelete = await jsonRequest(baseUrl, `/api/ai/memory/${createdMemory.body.memory.id}`, { cookie: sessionCookie(accountB.response), method: "DELETE" });
    assert.equal(crossAccountMemoryDelete.response.status, 404);
    assert.equal(workspaceB.body.data.inspirationCategories.some((item) => item.id === "a-category"), false);
    assert.deepEqual(workspaceB.body.data.inspirationCategories, []);
    const preferencesB = await jsonRequest(baseUrl, "/api/preferences", { cookie: sessionCookie(accountB.response) });
    assert.equal(preferencesB.body.themeId, "cosmic");

    const passwordChange = await jsonRequest(baseUrl, "/api/auth/password", {
      cookie: cookieA,
      method: "POST",
      body: { currentPassword: "TestPass123", nextPassword: "NextPass456" },
    });
    assert.equal(passwordChange.response.status, 200);
    const revokedSession = await jsonRequest(baseUrl, "/api/workspace", { cookie: cookieA });
    assert.equal(revokedSession.response.status, 401);
    const newLogin = await jsonRequest(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "a@example.test", password: "NextPass456" },
    });
    assert.equal(newLogin.response.status, 200);

    const reloadedA = await jsonRequest(baseUrl, "/api/workspace", { cookie: sessionCookie(newLogin.response) });
    assert.equal(reloadedA.body.data.todos[0].id, "a-only");
    assert.equal(reloadedA.body.data.todos[0].scheduleDate, aiContextDate);
    assert.equal(reloadedA.body.data.todos[0].deadline, "2099-08-10T18:00");
    assert.equal(reloadedA.body.data.inspirations[0].id, "a-inspiration");
    assert.equal(reloadedA.body.data.inspirations[0].title, "A 私有灵感");
    assert.deepEqual(reloadedA.body.data.inspirations[0].aiTags, ["镜头语言"]);
    assert.equal(reloadedA.body.data.inspirationCategories.find((item) => item.id === "a-category").icon, "spark");
    assert.equal(reloadedA.body.data.memories[0].id, "a-memory");
    const dailyInspirationA = await jsonRequest(baseUrl, "/api/inspiration/random", { cookie: sessionCookie(newLogin.response) });
    assert.deepEqual(dailyInspirationA.body, { id: "a-inspiration", title: "A 私有灵感", cover: "https://cdn.example.test/a.jpg", image: "https://cdn.example.test/a.jpg", platform: "douyin", category_name: "A 私有分类", source: "A 作者", ai_tags: ["镜头语言"] });
    const refreshedDailyInspirationA = await jsonRequest(baseUrl, "/api/inspiration/random", { cookie: sessionCookie(newLogin.response) });
    assert.deepEqual(refreshedDailyInspirationA.body, dailyInspirationA.body);
    const dailyInspirationB = await jsonRequest(baseUrl, "/api/inspiration/random", { cookie: sessionCookie(accountB.response) });
    assert.equal(dailyInspirationB.body, null);
    const memoriesA = await jsonRequest(baseUrl, "/api/ai/memory", { cookie: sessionCookie(newLogin.response) });
    assert.equal(memoriesA.body.memories.length, 1);
    assert.equal(memoriesA.body.memories[0].content, "A 的独立长期目标");
    assert.equal(reloadedA.body.data.inspirationCategories.some((item) => item.id === "a-category"), true);
    const anonymousAI = await jsonRequest(baseUrl, "/api/ai/status");
    assert.equal(anonymousAI.response.status, 401);
    const aiStatus = await jsonRequest(baseUrl, "/api/ai/status", { cookie: sessionCookie(newLogin.response) });
    assert.deepEqual(aiStatus.body, { configured: true, provider: "DeepSeek", model: "deepseek-chat" });
    const missingConsent = await jsonRequest(baseUrl, "/api/ai/insights", { cookie: sessionCookie(newLogin.response), method: "POST", body: { type: "weekly", scopes: ["memory"] } });
    assert.equal(missingConsent.response.status, 422);
    const generated = await jsonRequest(baseUrl, "/api/ai/insights", { cookie: sessionCookie(newLogin.response), method: "POST", body: { type: "weekly", scopes: ["memory", "todos"], consent: true } });
    assert.equal(generated.response.status, 201);
    assert.equal(generated.body.insight.provider, "DeepSeek");
    assert.equal(generated.body.insight.usage.totalTokens, 200);
    assert.equal(deepSeekRequests.length, 1);
    assert.equal(deepSeekRequests[0].authorization, "Bearer test-only-key");
    assert.match(deepSeekRequests[0].body.messages[1].content, /A 私有记忆/);
    const initialAuthorization = await jsonRequest(baseUrl, "/api/ai/context-authorization", { cookie: sessionCookie(newLogin.response) });
    assert.equal(initialAuthorization.body.authorized, true);
    assert.ok(initialAuthorization.body.authorizedAt);
    const disabledAuthorization = await jsonRequest(baseUrl, "/api/ai/context-authorization", { cookie: sessionCookie(newLogin.response), method: "PUT", body: { authorized: false } });
    assert.equal(disabledAuthorization.body.authorized, false);
    const restoredDisabledAuthorization = await jsonRequest(baseUrl, "/api/ai/context-authorization", { cookie: sessionCookie(newLogin.response) });
    assert.equal(restoredDisabledAuthorization.body.authorized, false);
    const unauthorizedChat = await jsonRequest(baseUrl, "/api/ai/chat", { cookie: sessionCookie(newLogin.response), method: "POST", body: { message: "未授权请求" } });
    assert.equal(unauthorizedChat.response.status, 403);
    assert.equal(deepSeekRequests.length, 1);
    const authorization = await jsonRequest(baseUrl, "/api/ai/context-authorization", { cookie: sessionCookie(newLogin.response), method: "PUT", body: { authorized: true, user_id: accountB.body.user.id } });
    assert.equal(authorization.response.status, 200);
    assert.equal(authorization.body.authorized, true);
    assert.ok(authorization.body.authorizedAt);
    const chat = await jsonRequest(baseUrl, "/api/ai/chat", { cookie: sessionCookie(newLogin.response), method: "POST", body: { userId: accountB.body.user.id, message: "分析我的当前状态", context: "B 的伪造上下文" } });
    assert.equal(chat.response.status, 200);
    assert.deepEqual(chat.body, { success: true, reply: "当前账户聊天回复" });
    assert.equal(deepSeekRequests.length, 2);
    assert.equal(deepSeekRequests[1].authorization, "Bearer test-only-key");
    assert.match(deepSeekRequests[1].body.messages[1].content, /Only A can read this/);
    assert.match(deepSeekRequests[1].body.messages[1].content, /A 的独立长期目标/);
    assert.equal(deepSeekRequests[1].body.messages[1].content.includes("B 的伪造上下文"), false);
    const dailyHistoryA = await jsonRequest(baseUrl, "/api/ai/conversations?conversation_id=daily_assistant&limit=20", { cookie: sessionCookie(newLogin.response) });
    assert.deepEqual(dailyHistoryA.body.messages.map(({ role, content }) => ({ role, content })), [
      { role: "user", content: "分析我的当前状态" },
      { role: "assistant", content: "当前账户聊天回复" },
    ]);
    const dailyHistoryB = await jsonRequest(baseUrl, "/api/ai/conversations?conversation_id=daily_assistant", { cookie: sessionCookie(accountB.response) });
    assert.deepEqual(dailyHistoryB.body.messages, []);
    const studyConversation = await jsonRequest(baseUrl, "/api/ai/conversations", { cookie: sessionCookie(newLogin.response), method: "POST", body: { conversation_id: "study_assistant", message: "整理学习计划", user_id: accountB.body.user.id } });
    assert.equal(studyConversation.response.status, 201);
    assert.equal(studyConversation.body.conversationId, "study_assistant");
    assert.equal(studyConversation.body.messages.length, 2);
    const failedConversation = await jsonRequest(baseUrl, "/api/ai/conversations", { cookie: sessionCookie(newLogin.response), method: "POST", body: { conversation_id: "creative_assistant", message: "触发失败" } });
    assert.equal(failedConversation.response.status, 502);
    const failedHistory = await jsonRequest(baseUrl, "/api/ai/conversations?conversation_id=creative_assistant", { cookie: sessionCookie(newLogin.response) });
    assert.deepEqual(failedHistory.body.messages, []);
    const firstInsight = await jsonRequest(baseUrl, "/api/ai/insights/today", { cookie: sessionCookie(newLogin.response), method: "POST" });
    assert.equal(firstInsight.response.status, 201);
    assert.equal(firstInsight.body.cached, false);
    assert.equal(firstInsight.body.insight.summary, "今日节奏稳定。");
    const requestsAfterFirstInsight = deepSeekRequests.length;
    const secondInsight = await jsonRequest(baseUrl, "/api/ai/insights/today", { cookie: sessionCookie(newLogin.response), method: "POST" });
    assert.equal(secondInsight.response.status, 200);
    assert.equal(secondInsight.body.cached, true);
    assert.equal(deepSeekRequests.length, requestsAfterFirstInsight);
    const restoredInsight = await jsonRequest(baseUrl, "/api/ai/insights/today", { cookie: sessionCookie(newLogin.response) });
    assert.deepEqual(restoredInsight.body.insight, firstInsight.body.insight);
    const crossAccountDelete = await jsonRequest(baseUrl, "/api/ai/conversations/study_assistant", { cookie: sessionCookie(accountB.response), method: "DELETE" });
    assert.equal(crossAccountDelete.body.deleted, 0);
    const studyHistoryA = await jsonRequest(baseUrl, "/api/ai/conversations?conversation_id=study_assistant", { cookie: sessionCookie(newLogin.response) });
    assert.equal(studyHistoryA.body.messages.length, 2);
    const deletedStudy = await jsonRequest(baseUrl, "/api/ai/conversations/study_assistant", { cookie: sessionCookie(newLogin.response), method: "DELETE" });
    assert.equal(deletedStudy.body.deleted, 2);
    const reportsA = await jsonRequest(baseUrl, "/api/ai/reports", { cookie: sessionCookie(newLogin.response) });
    const reportsB = await jsonRequest(baseUrl, "/api/ai/reports", { cookie: sessionCookie(accountB.response) });
    assert.equal(reportsA.body.reports.length, 1);
    assert.deepEqual(reportsB.body.reports, []);
    const preferencesA = await jsonRequest(baseUrl, "/api/preferences", { cookie: sessionCookie(newLogin.response) });
    assert.equal(preferencesA.body.themeId, "minimal");
    const database = new DatabaseSync(path.join(dataDir, "dazzjun.sqlite"), { readOnly: true });
    const categoryRows = database.prepare("SELECT user_id AS userId,name,sort_order AS sortOrder FROM inspiration_categories WHERE name='A 私有分类'").all().map((row) => ({ ...row }));
    const inspirationRows = database.prepare("SELECT user_id AS userId,platform,content,title,cover,author,source_text AS sourceText,category_name AS categoryName,ai_tags AS aiTags,url FROM inspirations WHERE content='A 私有灵感'").all().map((row) => ({ ...row, aiTags: JSON.parse(row.aiTags) }));
    const memoryRows = database.prepare("SELECT user_id AS userId,memory_type AS memoryType,content,importance FROM ai_memory").all().map((row) => ({ ...row }));
    const conversationRows = database.prepare("SELECT user_id AS userId,conversation_id AS conversationId,role,content FROM ai_conversations ORDER BY created_at,id").all().map((row) => ({ ...row }));
    const insightRows = database.prepare("SELECT user_id AS userId,summary FROM ai_insights").all().map((row) => ({ ...row }));
    assert.deepEqual(categoryRows, [{ userId: accountA.body.user.id, name: "A 私有分类", sortOrder: 1 }]);
    assert.deepEqual(inspirationRows, [{ userId: accountA.body.user.id, platform: "douyin", content: "A 私有灵感", title: "A 私有灵感", cover: "https://cdn.example.test/a.jpg", author: "A 作者", sourceText: "A 的分享文本", categoryName: "A 私有分类", aiTags: ["镜头语言"], url: "https://www.douyin.com/video/example" }]);
    assert.deepEqual(memoryRows, [{ userId: accountA.body.user.id, memoryType: "goal", content: "A 的独立长期目标", importance: 5 }]);
    assert.deepEqual(conversationRows.map(({ userId, conversationId, role }) => ({ userId, conversationId, role })), [
      { userId: accountA.body.user.id, conversationId: "daily_assistant", role: "user" },
      { userId: accountA.body.user.id, conversationId: "daily_assistant", role: "assistant" },
    ]);
    assert.deepEqual(insightRows, [{ userId: accountA.body.user.id, summary: "今日节奏稳定。" }]);
    database.close();
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    await new Promise((resolve) => deepSeek.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("DeepSeek provider rejects malformed structured output", async () => {
  const { generateWithDeepSeek } = await import("../worker/ai/providers/deepseek.js");
  await assert.rejects(() => generateWithDeepSeek({
    apiKey: "test", type: "daily", workspace: {}, scopes: ["todos"],
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200, headers: { "content-type": "application/json" } }),
  }), /无法解析/);
});

test("DeepSeek connectivity check uses the server key and returns the configured model", async () => {
  const { testDeepSeekConnection } = await import("../worker/ai/providers/deepseek.js");
  let authorization = "";
  const result = await testDeepSeekConnection({
    apiKey: "server-only-key",
    fetchImpl: async (_url, options) => {
      authorization = options.headers.authorization;
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.deepEqual(result, { success: true, model: "deepseek-chat" });
  assert.equal(authorization, "Bearer server-only-key");
});
