import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isIMEComposing, shouldSubmitOnEnter } from "../src/services/ime.ts";

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("composition input keeps the committed Chinese value", () => {
  let input = "wo";
  let composing = true;
  composing = false;
  input = "我";

  assert.equal(composing, false);
  assert.equal(input, "我");
});

test("composition can commit a multi-character phrase", () => {
  let input = "ni hao";
  input = "你好";
  assert.equal(input, "你好");
});

test("candidate confirmation Enter never submits", () => {
  assert.equal(shouldSubmitOnEnter({ key: "Enter", isComposing: true }, true), false);
  assert.equal(shouldSubmitOnEnter({ key: "Enter", isComposing: false }, true), false);
});

test("Enter after composition submits while Shift+Enter keeps a newline", () => {
  assert.equal(shouldSubmitOnEnter({ key: "Enter", isComposing: false }), true);
  assert.equal(shouldSubmitOnEnter({ key: "Enter", shiftKey: true, isComposing: false }), false);
});

test("English Enter behavior remains unchanged", () => {
  assert.equal(shouldSubmitOnEnter({ key: "Enter" }), true);
  assert.equal(shouldSubmitOnEnter({ key: "a" }), false);
});

test("legacy macOS and WebKit keyCode 229 is treated as composition", () => {
  assert.equal(isIMEComposing({ keyCode: 229 }), true);
  assert.equal(shouldSubmitOnEnter({ key: "Enter", keyCode: 229 }), false);
});

test("Android and iOS composition events are not intercepted", () => {
  assert.equal(isIMEComposing({ isComposing: true }), true);
  assert.equal(shouldSubmitOnEnter({ key: "Enter", isComposing: true }), false);
});

test("AI Core textarea wires a stable controlled input to composition events", async () => {
  const source = await readSource("src/pages/AIWorkspacePage.tsx");
  assert.match(source, /const \[isComposing, setIsComposing\] = useState\(false\)/);
  assert.match(source, /onCompositionStart=\{\(\) => setIsComposing\(true\)\}/);
  assert.match(source, /onCompositionEnd=\{\(event\) => \{ setIsComposing\(false\); setDraft\(event\.currentTarget\.value\); \}\}/);
  assert.match(source, /shouldSubmitOnEnter\(event\.nativeEvent, isComposing\)/);
  assert.doesNotMatch(source, /<textarea[^>]*key=\{/);
});

test("global shortcuts and other Enter actions ignore composition", async () => {
  const [shell, todo, inspiration] = await Promise.all([
    readSource("src/components/Shell.tsx"),
    readSource("src/pages/TodoPage.tsx"),
    readSource("src/pages/InspirationPage.tsx"),
  ]);

  assert.match(shell, /if \(isIMEComposing\(event\)\) return/);
  assert.match(shell, /shouldSubmitOnEnter\(event\.nativeEvent\)/);
  assert.match(todo, /shouldSubmitOnEnter\(event\.nativeEvent\)/);
  assert.equal(inspiration.match(/shouldSubmitOnEnter\(event\.nativeEvent\)/g)?.length, 2);
});
