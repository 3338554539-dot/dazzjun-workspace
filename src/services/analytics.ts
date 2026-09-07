import type { EnglishEntry, FitnessEntry, HabitCompletion, HabitId, InspirationItem, InspirationNote, LearningEntry, MoodEntry, TodoItem } from "../data/types";
import { isBetween, monthKey, todayISO, weekMeta } from "./date";
import { getTodayTasks, getTodoStats } from "./todoSelectors";

export const todoStats = getTodoStats;

export function currentWeekItems<T extends { date: string }>(items: T[]) {
  const week = weekMeta();
  return items.filter((item) => isBetween(item.date, week.start, week.end));
}

export function learningMinutesThisWeek(entries: LearningEntry[]) {
  return currentWeekItems(entries).reduce((sum, item) => sum + item.duration, 0);
}

export function fitnessThisWeek(entries: FitnessEntry[]) {
  const items = currentWeekItems(entries);
  return { sessions: items.length, minutes: items.reduce((sum, item) => sum + item.duration, 0), calories: items.reduce((sum, item) => sum + item.calories, 0) };
}

export function englishStreak(entries: EnglishEntry[]) {
  const dates = new Set(entries.filter((item) => item.checkedIn).map((item) => item.date));
  let streak = 0;
  const cursor = new Date(`${todayISO()}T12:00:00`);
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function englishMinutesThisWeek(entries: EnglishEntry[]) {
  return currentWeekItems(entries).reduce((sum, item) => sum + item.duration, 0);
}

export function latestMood(entries: MoodEntry[]) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function monthlyMood(entries: MoodEntry[]) {
  const month = monthKey();
  return entries.filter((entry) => entry.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
}

type HabitSources = {
  todos: TodoItem[];
  learning: LearningEntry[];
  english: EnglishEntry[];
  fitness: FitnessEntry[];
  inspirationNotes: InspirationNote[];
  habitCompletions: HabitCompletion[];
};

export function isHabitComplete(habitId: HabitId, date: string, data: HabitSources) {
  const manual = data.habitCompletions.find((item) => item.habitId === habitId && item.date === date);
  if (manual) return manual.completed;
  if (habitId === "reading") return data.learning.some((item) => item.date === date && item.category === "书籍") || data.todos.some((item) => item.done && item.scheduleDate === date && item.title.includes("阅读"));
  if (habitId === "english") return data.english.some((item) => item.date === date && item.checkedIn);
  if (habitId === "fitness") return data.fitness.some((item) => item.date === date && item.completed);
  if (habitId === "writing") return data.inspirationNotes.some((item) => item.createdAt.startsWith(date));
  return false;
}

export function habitStreak(habitId: HabitId, data: HabitSources) {
  let streak = 0;
  const cursor = new Date(`${todayISO()}T12:00:00`);
  while (isHabitComplete(habitId, cursor.toISOString().slice(0, 10), data)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function growthMetrics(data: Pick<HabitSources, "todos" | "learning" | "english" | "fitness"> & { moods: MoodEntry[] }) {
  const today = todayISO();
  const todayTodos = getTodayTasks(data.todos, today);
  const task = getTodoStats(todayTodos).progress;
  const learningMinutes = data.learning.filter((item) => item.date === today).reduce((sum, item) => sum + item.duration, 0) + data.english.filter((item) => item.date === today).reduce((sum, item) => sum + item.duration, 0);
  const learning = Math.min(100, Math.round(learningMinutes / 60 * 100));
  const fitness = data.fitness.some((item) => item.date === today && item.completed) ? 100 : 0;
  const mood = data.moods.find((item) => item.date === today)?.score ?? 0;
  return { task, learning, fitness, mood, overall: Math.round((task + learning + fitness + mood) / 4), learningMinutes };
}

export function yearOverview(data: Pick<HabitSources, "learning" | "english" | "fitness" | "inspirationNotes" | "habitCompletions" | "todos"> & { inspirations: InspirationItem[] }) {
  const year = String(new Date().getFullYear());
  const learning = data.learning.filter((item) => item.date.startsWith(year));
  const english = data.english.filter((item) => item.date.startsWith(year) && item.checkedIn);
  const fitness = data.fitness.filter((item) => item.date.startsWith(year) && item.completed);
  const notes = data.inspirationNotes.filter((item) => item.createdAt.startsWith(year));
  const inspirations = data.inspirations.filter((item) => item.createdAt.startsWith(year) && item.saved);
  const habitData: HabitSources = { ...data, moods: [] } as HabitSources;
  const streaks = (["reading", "english", "fitness", "writing", "sleep"] as HabitId[]).map((habit) => habitStreak(habit, habitData));
  return { year, learningSessions: learning.length + english.length, learningMinutes: learning.reduce((sum, item) => sum + item.duration, 0) + english.reduce((sum, item) => sum + item.duration, 0), notes: notes.length, inspirations: inspirations.length, fitnessSessions: fitness.length, bestStreak: Math.max(0, ...streaks) };
}
