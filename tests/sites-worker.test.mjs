import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import worker from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("preserves the AI Core path through the SPA fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/ai-core", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async (request) => {
      const pathname = new URL(request.url).pathname; calls.push(pathname);
      return new Response(pathname === "/index.html" ? "app" : "missing", { status: pathname === "/index.html" ? 200 : 404 });
    } },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/ai-core", "/index.html"]);
});

test("handles the root redirect returned by Cloudflare Assets for an app route", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/ai-core", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async (request) => {
      const pathname = new URL(request.url).pathname; calls.push(pathname);
      if (pathname === "/index.html") return new Response("app", { status: 200 });
      return new Response(null, { status: 307, headers: { location: "/" } });
    } },
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "app");
  assert.deepEqual(calls, ["/ai-core", "/index.html"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  }
});

test("health responds without a database query", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/health"), {
    DB: {},
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual({ status: payload.status, runtime: payload.runtime, database: payload.database }, { status: "ok", runtime: "cloudflare-worker", database: "connected" });
  assert.equal(Number.isNaN(Date.parse(payload.timestamp)), false);
});

test("known account APIs require the production database binding", async () => {
  let assetCalls = 0;
  const response = await worker.fetch(new Request("https://example.test/api/auth/session"), {
    ASSETS: { fetch: async () => { assetCalls += 1; return new Response("missing", { status: 404 }); } },
  });

  assert.equal(response.status, 503);
  assert.equal(assetCalls, 0);
  assert.match((await response.json()).error, /数据库/);
});

test("dynamic account APIs stay inside the Worker API boundary", async () => {
  for (const pathname of ["/api/ai/memory/memory-id", "/api/ai/conversations/study_assistant", "/api/inspiration/capture", "/api/inspiration/random"]) {
    let assetCalls = 0;
    const response = await worker.fetch(new Request(`https://example.test${pathname}`, { method: "DELETE" }), {
      ASSETS: { fetch: async () => { assetCalls += 1; return new Response("missing", { status: 404 }); } },
    });

    assert.equal(response.status, 503);
    assert.equal(assetCalls, 0);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});

test("production HTML references only emitted root assets", async () => {
  const client = new URL("../dist/client/", import.meta.url);
  const html = await readFile(new URL("index.html", client), "utf8");
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);

  assert.equal(html.includes("/@vite/client"), false);
  assert.equal(html.includes("/src/main.tsx"), false);
  assert.ok(references.includes("/dazzjun-mark.svg"));
  assert.ok(references.includes("/manifest.webmanifest"));

  for (const reference of references.filter((value) => value.startsWith("/"))) {
    await access(new URL(path.posix.relative("/", reference), client));
  }
});

test("PWA manifest uses production-root navigation and complete brand icons", async () => {
  const manifest = JSON.parse(await readFile(new URL("../dist/client/manifest.webmanifest", import.meta.url), "utf8"));

  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "zh-CN");
  assert.deepEqual(manifest.icons.map(({ src, sizes, purpose = "any" }) => ({ src, sizes, purpose })), [
    { src: "/dazzjun-mark.svg", sizes: "any", purpose: "any" },
    { src: "/icon-192.png", sizes: "192x192", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", purpose: "maskable" },
  ]);
});

test("PWA service worker precaches the app shell without pinning large wallpapers", async () => {
  const serviceWorker = await readFile(new URL("../dist/client/sw.js", import.meta.url), "utf8");

  assert.match(serviceWorker, /icon-192\.png/);
  assert.match(serviceWorker, /icon-512\.png/);
  assert.equal(serviceWorker.includes("theme-ocean-depths.png"), false);
  assert.equal(serviceWorker.includes("dazzjun-orbit-hero.png"), false);
  assert.equal(serviceWorker.includes("denylist:[/^\\/api\\//]"), true);
});

test("Cloudflare Assets keeps client-side routes inside the SPA", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));

  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.assets.not_found_handling, "single-page-application");
});
