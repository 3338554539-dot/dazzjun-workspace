import type { EnglishEntry, FitnessEntry, LearningEntry, MoodEntry } from "../data/types";
import { daysAgoISO, isBetween, todayISO, weekMeta } from "./date";

export type TimelinePeriod = "today" | "yesterday" | "week" | "older";

export function timelinePeriod(date: string, today = todayISO()): TimelinePeriod {
  if (date === today) return "today";
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (date === yesterdayISO) return "yesterday";
  const week = weekMeta(today);
  return isBetween(date, week.start, week.end) ? "week" : "older";
}

export function consecutiveDateStreak(dates: string[], today = todayISO()) {
  const unique = new Set(dates);
  let cursor = today;
  if (!unique.has(cursor)) cursor = daysAgoFrom(today, 1);
  let streak = 0;
  while (unique.has(cursor)) { streak += 1; cursor = daysAgoFrom(cursor, 1); }
  return streak;
}

function daysAgoFrom(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function moodGrowthStats(entries: MoodEntry[], today = todayISO()) {
  const sevenDays = new Set(Array.from({ length: 7 }, (_, index) => daysAgoFrom(today, index)));
  const recent = entries.filter((entry) => sevenDays.has(entry.date));
  const week = weekMeta(today);
  const weekly = entries.filter((entry) => isBetween(entry.date, week.start, week.end));
  return {
    today: entries.find((entry) => entry.date === today),
    weeklyCount: weekly.length,
    average: recent.length ? Math.round(recent.reduce((sum, entry) => sum + entry.score, 0) / recent.length) : 0,
    streak: consecutiveDateStreak(entries.map((entry) => entry.date), today),
    recent,
  };
}

export function learningGrowthStats(entries: LearningEntry[], today = todayISO()) {
  const week = weekMeta(today);
  const weekly = entries.filter((entry) => isBetween(entry.date, week.start, week.end));
  const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  return { weeklyMinutes: weekly.reduce((sum, entry) => sum + entry.duration, 0), weeklyCount: weekly.length, total: entries.length, latestTopic: latest?.category ?? "暂无" };
}

export interface EnglishPracticeNote { learned: string; words: string; expressions: string; material: string; summary: string }
const englishMarker = "[ENGLISH_PRACTICE_V1]";

export function encodeEnglishPracticeNote(value: EnglishPracticeNote) {
  return `${englishMarker}\n${JSON.stringify(value)}`;
}

export function decodeEnglishPracticeNote(note: string): EnglishPracticeNote {
  const empty = { learned: "", words: "", expressions: "", material: "", summary: "" };
  if (!note.startsWith(englishMarker)) return { ...empty, summary: note };
  try { return { ...empty, ...JSON.parse(note.slice(englishMarker.length).trim()) }; }
  catch { return { ...empty, summary: note }; }
}

export function fitnessGrowthStats(entries: FitnessEntry[], today = todayISO()) {
  const week = weekMeta(today);
  const weekly = entries.filter((entry) => isBetween(entry.date, week.start, week.end));
  return {
    weekly,
    sessions: weekly.length,
    minutes: weekly.reduce((sum, entry) => sum + entry.duration, 0),
    calories: weekly.reduce((sum, entry) => sum + entry.calories, 0),
    streak: consecutiveDateStreak(entries.filter((entry) => entry.completed).map((entry) => entry.date), today),
  };
}
