import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("auth startup uses an explicit three-state model", async () => {
  const [userModel, provider] = await Promise.all([
    readSource("src/models/user.ts"),
    readSource("src/auth/AuthProvider.tsx"),
  ]);

  assert.match(userModel, /AuthStatus\s*=\s*"loading"\s*\|\s*"authenticated"\s*\|\s*"unauthenticated"/);
  assert.match(provider, /authStatus:\s*"loading"/);
  assert.match(provider, /authLoading:\s*authState\.authStatus\s*===\s*"loading"/);
  assert.match(provider, /await authApi\.session\(\)/);
});

test("platform gate never renders login while session restoration is loading", async () => {
  const gate = await readSource("src/components/PlatformGate.tsx");
  const loadingBranch = gate.indexOf('authStatus === "loading"');
  const loginBranch = gate.indexOf('authStatus === "unauthenticated"');
  const workspaceBranch = gate.indexOf("<AccountDataProvider>");

  assert.ok(loadingBranch >= 0, "missing auth loading branch");
  assert.ok(loginBranch > loadingBranch, "login branch must follow loading branch");
  assert.ok(workspaceBranch > loginBranch, "workspace should render only after auth resolution");
  assert.doesNotMatch(gate, /if\s*\(\s*!user\s*\)\s*return\s*<AuthGateway/);
});

test("session restoration is abortable and bounded to five seconds", async () => {
  const client = await readSource("src/api/client.ts");
  assert.match(client, /new AbortController\(\)/);
  assert.match(client, /controller\.abort\(\)/);
  assert.match(client, /session:\s*\(\)\s*=>[\s\S]*?timeoutMs:\s*5000/);
});

test("PWA updates do not reload pages during background controller changes", async () => {
  const [updateSource, viteConfig] = await Promise.all([
    readSource("src/pwa/update.ts"),
    readSource("vite.config.mjs"),
  ]);

  assert.doesNotMatch(updateSource, /controllerchange/);
  assert.doesNotMatch(updateSource, /window\.location\.reload/);
  assert.match(viteConfig, /registerType:\s*"prompt"/);
  assert.match(viteConfig, /skipWaiting:\s*false/);
});

test("AI Core path is restored directly from the current location", async () => {
  const app = await readSource("src/App.tsx");
  assert.match(app, /ai:\s*"\/ai-core"/);
  assert.match(app, /useState<PageKey>\(pageFromLocation\)/);
});

test("workspace module paths survive direct refreshes", async () => {
  const app = await readSource("src/App.tsx");
  for (const path of ["/todo", "/mood", "/learning", "/english", "/fitness", "/weekly", "/inspiration", "/ai-core"]) {
    assert.ok(app.includes(`"${path}"`), `missing direct route ${path}`);
  }
  assert.match(app, /pagePaths\[page\]/);
});
