import assert from "node:assert/strict";
import test from "node:test";
import { buildAIContext, loadAIContext } from "../worker/ai/context.ts";
import { chatWithDeepSeek } from "../worker/ai/deepseek.ts";
import { DAZZJUN_ASSISTANT_PROMPT } from "../worker/ai/prompt.ts";
import { generateAIResponse } from "../worker/ai/service.ts";
import { normalizeAIMemoryInput } from "../worker/ai/memory.ts";
import { dateInTimeZone } from "../worker/ai/todoSelectors.ts";
import { handleApiRequest } from "../worker/api.js";
import { buildDeepSeekMessages, MAX_REPORT_CONTEXT_LENGTH } from "../worker/ai/prompts.js";

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

test("Dazzjun prompt defines the dedicated assistant persona", () => {
  assert.match(DAZZJUN_ASSISTANT_PROMPT, /Dazzjun AI Assistant/);
  assert.match(DAZZJUN_ASSISTANT_PROMPT, /个人成长助手/);
  assert.match(DAZZJUN_ASSISTANT_PROMPT, /创意伙伴/);
  assert.match(DAZZJUN_ASSISTANT_PROMPT, /生活记录分析助手/);
});

test("DeepSeek chat keeps the API key server-side and normalizes the response", async () => {
  let captured;
  const result = await chatWithDeepSeek({
    apiKey: "server-secret",
    messages: [{ role: "user", content: "你好" }],
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return jsonResponse({
        choices: [{ message: { content: "  你好，我在。  " } }],
        usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 },
      });
    },
  });

  assert.equal(captured.options.headers.authorization, "Bearer server-secret");
  assert.equal(JSON.stringify(captured.options.body).includes("server-secret"), false);
  assert.deepEqual(result, {
    success: true,
    content: "你好，我在。",
    usage: { promptTokens: 8, completionTokens: 5, totalTokens: 13 },
  });
});

test("AI service validates identity and message boundaries", async () => {
  const base = { userId: "account-a", apiKey: "secret", fetchImpl: async () => jsonResponse({}) };
  await assert.rejects(() => generateAIResponse({ ...base, message: "" }), /请输入消息/);
  await assert.rejects(() => generateAIResponse({ ...base, message: "x".repeat(4_001) }), /4000/);
  await assert.rejects(() => generateAIResponse({ ...base, message: "hello", context: "x".repeat(12_001) }), /12000/);
  await assert.rejects(() => generateAIResponse({ ...base, userId: "", message: "hello" }), /用户身份无效/);
});

test("AI report context is capped before it reaches the provider", () => {
  const records = Array.from({ length: 80 }, (_, index) => ({ id: index, content: "x".repeat(1_000) }));
  const messages = buildDeepSeekMessages("weekly", { todos: records, learning: records }, ["todos", "learning"]);
  const serializedContext = messages[1].content.split("个人数据摘要：")[1];
  assert.ok(serializedContext.length <= MAX_REPORT_CONTEXT_LENGTH + 1);
  assert.match(serializedContext, /…$/);
});

test("AI service builds a scoped request without exposing the account id", async () => {
  let requestBody;
  await generateAIResponse({
    userId: "private-account-id",
    message: "帮我规划今天",
    context: "今天有两项任务",
    apiKey: "secret",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return jsonResponse({ choices: [{ message: { content: "先完成最重要的一项。" } }] });
    },
  });

  const serialized = JSON.stringify(requestBody);
  assert.match(serialized, /今天有两项任务/);
  assert.match(serialized, /帮我规划今天/);
  assert.equal(serialized.includes("private-account-id"), false);
});

test("DeepSeek errors are safe and malformed success payloads are rejected", async () => {
  await assert.rejects(() => chatWithDeepSeek({
    apiKey: "secret",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl: async () => jsonResponse({ error: { message: "provider internals" } }, 500),
    retryDelayMs: 0,
  }), /DeepSeek API 返回错误/);

  await assert.rejects(() => chatWithDeepSeek({
    apiKey: "secret",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl: async () => jsonResponse({ choices: [] }),
    retryDelayMs: 0,
  }), /返回内容无效/);
});

test("DeepSeek retries one transient failure and distinguishes timeout from network errors", async () => {
  let retryCalls = 0;
  const recovered = await chatWithDeepSeek({
    apiKey: "secret",
    messages: [{ role: "user", content: "retry" }],
    retryDelayMs: 0,
    fetchImpl: async () => {
      retryCalls += 1;
      if (retryCalls === 1) throw new TypeError("network down");
      return jsonResponse({ choices: [{ message: { content: "recovered" } }] });
    },
  });
  assert.equal(recovered.content, "recovered");
  assert.equal(retryCalls, 2);

  let timeoutCalls = 0;
  await assert.rejects(() => chatWithDeepSeek({
    apiKey: "secret",
    messages: [{ role: "user", content: "timeout" }],
    timeoutMs: 5,
    retryDelayMs: 0,
    fetchImpl: async (_url, options) => await new Promise((_resolve, reject) => {
      timeoutCalls += 1;
      options.signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); }, { once: true });
    }),
  }), (error) => error.code === "DEEPSEEK_TIMEOUT" && error.status === 504);
  assert.equal(timeoutCalls, 2);

  let networkCalls = 0;
  await assert.rejects(() => chatWithDeepSeek({
    apiKey: "secret",
    messages: [{ role: "user", content: "network" }],
    retryDelayMs: 0,
    fetchImpl: async () => { networkCalls += 1; throw new TypeError("offline"); },
  }), (error) => error.code === "DEEPSEEK_NETWORK_ERROR" && error.status === 502);
  assert.equal(networkCalls, 2);
});

test("AI context separates short-term records from explicit long-term memory", () => {
  const context = JSON.parse(buildAIContext({
    todos: [{ title: "完成当前账户任务", category: "工作", priority: "高", scheduleDate: "2026-07-31", deadline: "2026-08-01T18:00", done: false }],
    moods: [{ date: "2026-07-31", mood: "平静", score: 80, story: "完成开发", note: "保持节奏" }],
    learning: [{ date: "2026-07-31", title: "TypeScript", duration: 45, content: "类型设计", gain: "边界更清晰" }],
    english: [{ date: "2026-07-31", checkedIn: true, duration: 20, words: 30, exercises: 2, categories: ["阅读"], note: "完成" }],
    fitness: [{ date: "2026-07-31", title: "跑步", duration: 30, calories: 260, completed: true, plan: "轻松跑" }],
    inspirations: [{ createdAt: "2026-07-31", platform: "小红书", content: "视觉灵感", categoryId: "design", saved: true, url: "https://private.example" }],
    inspirationCategories: [{ id: "design", name: "设计" }],
    memories: [{ title: "不得发送的长期记忆" }],
  }, new Date("2026-07-31T00:00:00.000Z"), [{ memoryType: "goal", content: "完成公开作品集", importance: 5, source: "user", updatedAt: "2026-07-31T00:00:00.000Z" }]));

  assert.deepEqual(context.structure, ["Short Term Context", "Long Term Memory", "Current Task"]);
  assert.deepEqual(context.scope, ["Todo", "Mood", "Study", "English", "Fitness", "Inspiration", "AI Memory"]);
  assert.equal(context.shortTermContext.recent.todo[0].title, "完成当前账户任务");
  assert.equal(context.shortTermContext.recent.inspiration[0].category, "设计");
  assert.equal(context.longTermMemory[0].content, "完成公开作品集");
  assert.equal(JSON.stringify(context).includes("private.example"), false);
  assert.equal(JSON.stringify(context).includes("不得发送的长期记忆"), false);
});

test("AI context query is bound to the authenticated account", async () => {
  const boundUserIds = [];
  const db = {
    prepare: (query) => {
      assert.match(query, /WHERE user_id=\?/);
      return { bind: (userId) => ({
        first: async () => {
          boundUserIds.push(userId);
          return { payload: JSON.stringify({ todos: [{ title: "A 的任务", scheduleDate: "2026-07-31" }] }) };
        },
        all: async () => {
          boundUserIds.push(userId);
          return { results: [{ id: "memory-a", memoryType: "goal", content: "A 的长期目标", importance: 5, source: "user", createdAt: "2026-07-31", updatedAt: "2026-07-31" }] };
        },
        run: async () => ({ meta: { changes: query.includes("INSERT INTO rate_limit_buckets") ? 1 : 0 } }),
      }) };
    },
  };
  const context = await loadAIContext({ db, userId: "account-a", now: new Date("2026-07-31T00:00:00.000Z") });
  assert.deepEqual(boundUserIds, ["account-a", "account-a"]);
  assert.match(context, /A 的任务/);
  assert.match(context, /A 的长期目标/);
});

test("AI memory input accepts only fixed types and bounded importance", () => {
  assert.deepEqual(normalizeAIMemoryInput({ memoryType: "goal", content: "  完成个人作品集  ", importance: 5 }), {
    memoryType: "goal", content: "完成个人作品集", importance: 5, source: "user",
  });
  assert.throws(() => normalizeAIMemoryInput({ memoryType: "chat", content: "不允许" }), /记忆类型/);
  assert.throws(() => normalizeAIMemoryInput({ memoryType: "goal", content: "目标", importance: 8 }), /1–5/);
});

test("POST /api/ai/chat requires an authenticated session", async () => {
  const response = await handleApiRequest(new Request("https://dazzjun.test/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "hello", context: "" }),
  }), { DB: {}, DEEPSEEK_API_KEY: "secret" });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "请先登录" });
});

test("GET context authorization initializes a missing Worker record as enabled", async () => {
  let authorizationRow = null;
  let insertedUserId = "";
  const DB = {
    prepare: (query) => ({
      bind: (...values) => ({
        first: async () => {
          if (query.includes("FROM sessions")) return { id: "account-a", displayName: "Dazzjun User" };
          if (query.includes("FROM ai_context_authorizations")) return authorizationRow;
          return null;
        },
        run: async () => {
          if (query.startsWith("INSERT OR IGNORE INTO ai_context_authorizations")) {
            insertedUserId = values[0];
            authorizationRow = { authorized: 1, authorizedAt: values[1], updatedAt: values[2] };
          }
          return { meta: { changes: 1 } };
        },
      }),
    }),
  };

  const response = await handleApiRequest(new Request("https://dazzjun.test/api/ai/context-authorization", {
    headers: { cookie: "dazzjun_session=test-session" },
  }), { DB });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.authorized, true);
  assert.ok(payload.authorizedAt);
  assert.equal(insertedUserId, "account-a");
});

test("POST /api/ai/chat derives identity from the session and returns the public contract", async () => {
  const today = dateInTimeZone(new Date());
  const originalFetch = globalThis.fetch;
  let providerBody;
  globalThis.fetch = async (_url, options) => {
    providerBody = JSON.parse(options.body);
    return jsonResponse({
      choices: [{ message: { content: "这是你的今日建议。" } }],
      usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
    });
  };

  const contextBindings = [];
  const conversationWrites = [];
  const DB = {
    prepare: (query) => ({
      bind: (...values) => ({
        first: async () => {
          if (query.includes("FROM sessions")) return { id: "authenticated-account", displayName: "Dazzjun User" };
          if (query.includes("FROM ai_context_authorizations")) return { authorized: 1, authorizedAt: "2026-07-31", updatedAt: "2026-07-31" };
          contextBindings.push(values[0]);
          return { payload: JSON.stringify({ todos: [{ title: "当前账户的专属任务", scheduleDate: today, done: false }] }) };
        },
        all: async () => {
          contextBindings.push(values[0]);
          return { results: [{ id: "memory-a", memoryType: "goal", content: "当前账户的长期目标", importance: 5, source: "user", createdAt: "2026-07-31", updatedAt: "2026-07-31" }] };
        },
        run: async () => {
          if (query.startsWith("INSERT INTO ai_conversations")) conversationWrites.push(values);
          return { meta: { changes: 1 } };
        },
      }),
    }),
    batch: async (statements) => await Promise.all(statements.map((statement) => statement.run())),
  };

  try {
    const response = await handleApiRequest(new Request("https://dazzjun.test/api/ai/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dazzjun_session=test-session",
      },
      body: JSON.stringify({
        userId: "another-account",
        message: "给我一条建议",
        context: "另一个账户的伪造上下文",
      }),
    }), { DB, DEEPSEEK_API_KEY: "worker-secret" });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, reply: "这是你的今日建议。" });
    assert.equal(JSON.stringify(providerBody).includes("another-account"), false);
    assert.equal(JSON.stringify(providerBody).includes("authenticated-account"), false);
    assert.equal(JSON.stringify(providerBody).includes("另一个账户的伪造上下文"), false);
    assert.match(JSON.stringify(providerBody), /当前账户的专属任务/);
    assert.match(JSON.stringify(providerBody), /当前账户的长期目标/);
    assert.deepEqual(contextBindings, ["authenticated-account", "authenticated-account"]);
    assert.equal(conversationWrites.length, 2);
    assert.deepEqual(conversationWrites.map((values) => ({ conversationId: values[1], userId: values[2], role: values[3] })), [
      { conversationId: "daily_assistant", userId: "authenticated-account", role: "user" },
      { conversationId: "daily_assistant", userId: "authenticated-account", role: "assistant" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("conversation persistence performs no D1 batch before authorization and provider success", async () => {
  const originalFetch = globalThis.fetch;
  let authorized = false;
  let providerCalls = 0;
  let batchCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    return jsonResponse({ error: { message: "provider failed" } }, 500);
  };
  const DB = {
    prepare: (query) => ({
      bind: () => ({
        first: async () => {
          if (query.includes("FROM sessions")) return { id: "account-a", displayName: "Dazzjun User" };
          if (query.includes("FROM ai_context_authorizations")) return { authorized: authorized ? 1 : 0, authorizedAt: null, updatedAt: null };
          if (query.includes("FROM user_workspaces")) return { payload: JSON.stringify({ todos: [] }) };
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: query.includes("INSERT INTO rate_limit_buckets") ? 1 : 0 } }),
      }),
    }),
    batch: async () => { batchCalls += 1; return []; },
  };
  const request = () => new Request("https://dazzjun.test/api/ai/conversations", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "dazzjun_session=test-session" },
    body: JSON.stringify({ conversation_id: "creative_assistant", message: "整理创意" }),
  });

  try {
    const denied = await handleApiRequest(request(), { DB, DEEPSEEK_API_KEY: "worker-secret" });
    assert.equal(denied.status, 403);
    assert.equal(providerCalls, 0);
    assert.equal(batchCalls, 0);

    authorized = true;
    const failed = await handleApiRequest(request(), { DB, DEEPSEEK_API_KEY: "worker-secret" });
    assert.equal(failed.status, 502);
    assert.equal(providerCalls, 2);
    assert.equal(batchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("conversation API reports D1 persistence failures separately", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ choices: [{ message: { content: "回复已生成" } }] });
  const DB = {
    prepare: (query) => ({
      bind: () => ({
        first: async () => {
          if (query.includes("FROM sessions")) return { id: "account-a", displayName: "Dazzjun User" };
          if (query.includes("FROM ai_context_authorizations")) return { authorized: 1, authorizedAt: "2026-08-01", updatedAt: "2026-08-01" };
          if (query.includes("FROM user_workspaces")) return { payload: JSON.stringify({ todos: [] }) };
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: query.includes("INSERT INTO rate_limit_buckets") ? 1 : 0 } }),
      }),
    }),
    batch: async () => { throw new Error("D1 unavailable"); },
  };
  try {
    const response = await handleApiRequest(new Request("https://dazzjun.test/api/ai/conversations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "dazzjun_session=test-session" },
      body: JSON.stringify({ conversation_id: "daily_assistant", message: "你好" }),
    }), { DB, DEEPSEEK_API_KEY: "worker-secret" });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "AI 回复已生成，但 D1 对话保存失败，请重试", code: "D1_SAVE_FAILED" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI memory API derives ownership from the session for create, list and delete", async () => {
  let sessionUserId = "account-a";
  const rows = [];
  const DB = {
    prepare: (query) => ({
      bind: (...values) => ({
        first: async () => {
          if (query.includes("FROM sessions")) return { id: sessionUserId, displayName: "Dazzjun User" };
          if (query.includes("SELECT id FROM ai_memory")) return rows.find((row) => row.id === values[0] && row.userId === values[1]) ?? null;
          return null;
        },
        all: async () => ({ results: rows.filter((row) => row.userId === values[0]).map(({ userId: _userId, ...row }) => row) }),
        run: async () => {
          if (query.startsWith("INSERT INTO ai_memory")) {
            const [id, userId, memoryType, content, importance, source, createdAt, updatedAt] = values;
            rows.push({ id, userId, memoryType, content, importance, source, createdAt, updatedAt });
          }
          if (query.startsWith("DELETE FROM ai_memory")) {
            const index = rows.findIndex((row) => row.id === values[0] && row.userId === values[1]);
            if (index >= 0) rows.splice(index, 1);
          }
          return { meta: { changes: 1 } };
        },
      }),
    }),
  };
  const headers = { "content-type": "application/json", cookie: "dazzjun_session=test-session" };
  const createdResponse = await handleApiRequest(new Request("https://dazzjun.test/api/ai/memory", {
    method: "POST", headers, body: JSON.stringify({ userId: "account-b", memoryType: "goal", content: "A 的长期目标", importance: 5 }),
  }), { DB });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).memory;
  assert.equal(rows[0].userId, "account-a");

  const listA = await handleApiRequest(new Request("https://dazzjun.test/api/ai/memory", { headers }), { DB });
  assert.equal((await listA.json()).memories.length, 1);

  sessionUserId = "account-b";
  const listB = await handleApiRequest(new Request("https://dazzjun.test/api/ai/memory", { headers }), { DB });
  assert.deepEqual((await listB.json()).memories, []);
  const crossAccountDelete = await handleApiRequest(new Request(`https://dazzjun.test/api/ai/memory/${created.id}`, { method: "DELETE", headers }), { DB });
  assert.equal(crossAccountDelete.status, 404);

  sessionUserId = "account-a";
  const deleted = await handleApiRequest(new Request(`https://dazzjun.test/api/ai/memory/${created.id}`, { method: "DELETE", headers }), { DB });
  assert.equal(deleted.status, 200);
  assert.deepEqual(rows, []);
});
