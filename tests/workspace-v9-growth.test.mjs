import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("mood page uses the Phase 9 journal workspace and saves through the existing store", async () => {
  const source = await read("src/pages/MoodPage.tsx");
  assert.match(source, /EMOTIONAL JOURNAL/);
  assert.match(source, /growth-main-grid/);
  assert.match(source, /upsertMood\(/);
});

test("learning vault retains legacy fallback, rich blocks, uploads and confirmed persistence", async () => {
  const [page, blocks, defaults] = await Promise.all([
    read("src/pages/LearningPage.tsx"), read("src/services/learningBlocks.ts"), read("src/data/defaults.ts"),
  ]);
  assert.match(page, /LEARNING VAULT/);
  assert.match(page, /learningBlocks: cleanBlocks/);
  assert.match(page, /saveLearningEntryConsistently/);
  assert.match(page, /learningApi\.upload/);
  assert.match(blocks, /entry\.learningBlocks/);
  assert.match(defaults, /raw\.learningContent/);
  assert.match(defaults, /raw\.learningNote/);
  assert.match(defaults, /raw\.reflection/);
});

test("English Practice saves structured practice fields through the existing entry action", async () => {
  const [page, service] = await Promise.all([read("src/pages/EnglishPage.tsx"), read("src/services/growthModules.ts")]);
  assert.match(page, /ENGLISH PRACTICE/);
  assert.match(page, /upsertEnglish\(/);
  assert.match(page, /encodeEnglishPracticeNote\(practice\)/);
  assert.match(service, /decodeEnglishPracticeNote/);
});

test("Fitness Rhythm preserves addFitness persistence and plan compatibility", async () => {
  const page = await read("src/pages/FitnessPage.tsx");
  assert.match(page, /FITNESS RHYTHM/);
  assert.match(page, /addFitness\(/);
  assert.match(page, /plan: form\.plan\.trim\(\)/);
});

test("growth modules receive a collapsible rail and a two-column compact mobile strip", async () => {
  const [shell, rail, css] = await Promise.all([read("src/components/Shell.tsx"), read("src/components/workspace/ContextRail.tsx"), read("src/workspace-v9.css")]);
  assert.match(shell, /railPages\.includes|active === "mood"|active === "learning"/);
  assert.match(rail, /growthPages/);
  assert.match(rail, /GrowthRailContent/);
  assert.match(css, /\.growth-status-strip \{ grid-template-columns: 1fr 1fr; \}/);
  assert.match(css, /\.growth-main-grid \{ display: flex; flex-direction: column; \}/);
  assert.match(css, /overflow-x: hidden/);
});
