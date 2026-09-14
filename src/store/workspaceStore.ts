import { create } from "zustand";
import type { AIInsightRecord, AINotificationRecord, EnglishEntry, FitnessEntry, GrowthGoals, HabitId, InspirationItem, InspirationNote, KnowledgeLink, LearningEntry, MemoryItem, MoodEntry, TodoItem, WeeklyReview, WorkspaceData, WorkspaceModule } from "../data/types";
import { cleanCategoryName, defaultWorkspaceData, normalizeWorkspaceData } from "../data/defaults";
import { weekMeta } from "../services/date";
import { applyTodoPatch } from "../services/todoSelectors";

type WorkspaceActions = {
  addTodo: (todo: Omit<TodoItem, "id" | "createdAt" | "done">) => void;
  updateTodo: (id: string, patch: Partial<TodoItem>) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  clearCompletedTodos: () => void;
  upsertMood: (entry: Omit<MoodEntry, "id" | "updatedAt">) => void;
  addLearning: (entry: Omit<LearningEntry, "createdAt">) => void;
  upsertEnglish: (entry: Omit<EnglishEntry, "id" | "updatedAt">) => void;
  addFitness: (entry: Omit<FitnessEntry, "id" | "createdAt">) => void;
  ensureWeeklyReview: (dateOrOffset?: string | number) => WeeklyReview;
  updateWeeklyReview: (weekKey: string, patch: Partial<WeeklyReview>) => void;
  addInspiration: (entry: Omit<InspirationItem, "id" | "createdAt" | "saved" | "portal"> & Partial<Pick<InspirationItem, "portal">>) => void;
  updateInspiration: (id: string, patch: Partial<Pick<InspirationItem, "cover" | "image" | "coverSource" | "coverType">>) => void;
  toggleInspiration: (id: string) => void;
  deleteInspiration: (id: string) => void;
  addInspirationCategory: (name: string) => void;
  renameInspirationCategory: (id: string, name: string) => void;
  deleteInspirationCategory: (id: string) => void;
  moveInspirationCategory: (id: string, direction: "up" | "down") => void;
  addInspirationNote: (entry: Pick<InspirationNote, "title" | "content" | "tags">) => void;
  updateInspirationNote: (id: string, patch: Partial<Pick<InspirationNote, "title" | "content" | "tags">>) => void;
  toggleInspirationNoteFavorite: (id: string) => void;
  toggleInspirationNotePinned: (id: string) => void;
  deleteInspirationNote: (id: string) => void;
  addInspirationTag: (tag: string) => void;
  renameInspirationTag: (current: string, next: string) => void;
  setHabitCompletion: (habitId: HabitId, date: string, completed: boolean) => void;
  linkInspiration: (noteId: string, inspirationId: string) => void;
  unlinkInspiration: (noteId: string, inspirationId: string) => void;
  saveAIInsight: (insight: Omit<AIInsightRecord, "id">) => void;
  addKnowledgeLink: (link: Omit<KnowledgeLink, "id" | "createdAt" | "source">) => void;
  deleteKnowledgeLink: (id: string) => void;
  addMemory: (memory: Pick<MemoryItem, "kind" | "title" | "value"> & Partial<Pick<MemoryItem, "source" | "confidence">>) => void;
  updateMemory: (id: string, patch: Partial<Pick<MemoryItem, "kind" | "title" | "value" | "confidence">>) => void;
  deleteMemory: (id: string) => void;
  recordUsage: (module: WorkspaceModule) => void;
  dismissAINotification: (notification: Omit<AINotificationRecord, "dismissedAt">) => void;
  restoreWorkspace: (data: WorkspaceData) => void;
  loadAccountWorkspace: (data: WorkspaceData) => void;
  clearAccountWorkspace: () => void;
  updateGoals: (patch: Partial<GrowthGoals>) => void;
  resetWorkspace: () => void;
};

export type WorkspaceStore = WorkspaceData & WorkspaceActions;

const cleanWorkspace = () => structuredClone(defaultWorkspaceData);
const initial = cleanWorkspace();

export const useWorkspaceStore = create<WorkspaceStore>()(
    (set, get) => ({
      ...initial,
      addTodo: (todo) => set((state) => ({ todos: [...state.todos, { ...todo, id: crypto.randomUUID(), done: false, createdAt: new Date().toISOString() }] })),
      updateTodo: (id, patch) => set((state) => ({ todos: state.todos.map((todo) => todo.id === id ? applyTodoPatch(todo, patch) : todo) })),
      toggleTodo: (id) => set((state) => ({ todos: state.todos.map((todo) => todo.id === id ? { ...todo, done: !todo.done, completedAt: !todo.done ? new Date().toISOString() : undefined } : todo) })),
      deleteTodo: (id) => set((state) => ({ todos: state.todos.filter((todo) => todo.id !== id) })),
      clearCompletedTodos: () => set((state) => ({ todos: state.todos.filter((todo) => !todo.done) })),
      upsertMood: (entry) => set((state) => {
        const existing = state.moods.find((mood) => mood.date === entry.date);
        const next = { ...entry, id: existing?.id ?? crypto.randomUUID(), updatedAt: new Date().toISOString() };
        return { moods: existing ? state.moods.map((mood) => mood.id === existing.id ? next : mood) : [...state.moods, next] };
      }),
      addLearning: (entry) => set((state) => {
        const id = entry.id || crypto.randomUUID();
        const existing = state.learning.find((item) => item.id === id);
        const next = { ...entry, id, createdAt: existing?.createdAt || new Date().toISOString() };
        return { learning: existing ? state.learning.map((item) => item.id === id ? next : item) : [next, ...state.learning] };
      }),
      upsertEnglish: (entry) => set((state) => {
        const existing = state.english.find((item) => item.date === entry.date);
        const next = { ...entry, id: existing?.id ?? crypto.randomUUID(), updatedAt: new Date().toISOString() };
        return { english: existing ? state.english.map((item) => item.id === existing.id ? next : item) : [...state.english, next] };
      }),
      addFitness: (entry) => set((state) => ({ fitness: [{ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...state.fitness] })),
      ensureWeeklyReview: (dateOrOffset = 0) => {
        const meta = typeof dateOrOffset === "number" ? weekMeta(new Date(), dateOrOffset) : weekMeta(dateOrOffset);
        const existing = get().weeklyReviews.find((review) => review.weekKey === meta.weekKey);
        if (existing) return existing;
        const review: WeeklyReview = { id: `week-${meta.weekKey}`, ...meta, completed: "", obstacles: "", improvements: "", highlights: "", updatedAt: new Date().toISOString() };
        set((state) => ({ weeklyReviews: [...state.weeklyReviews, review] }));
        return review;
      },
      updateWeeklyReview: (weekKey, patch) => set((state) => ({ weeklyReviews: state.weeklyReviews.map((review) => review.weekKey === weekKey ? { ...review, ...patch, updatedAt: new Date().toISOString() } : review) })),
      addInspiration: (entry) => set((state) => ({ inspirations: [{ ...entry, portal: entry.portal ?? (entry.platform === "xiaohongshu" ? "小红书" : "抖音"), id: crypto.randomUUID(), saved: true, createdAt: new Date().toISOString().slice(0, 10) }, ...state.inspirations] })),
      updateInspiration: (id, patch) => set((state) => ({ inspirations: state.inspirations.map((item) => item.id === id ? { ...item, ...patch } : item) })),
      toggleInspiration: (id) => set((state) => ({ inspirations: state.inspirations.map((item) => item.id === id ? { ...item, saved: !item.saved } : item) })),
      deleteInspiration: (id) => set((state) => ({ inspirations: state.inspirations.filter((item) => item.id !== id) })),
      addInspirationCategory: (name) => set((state) => {
        const clean = cleanCategoryName(name);
        if (!clean || state.inspirationCategories.some((item) => item.name.toLowerCase() === clean.toLowerCase())) return {};
        return { inspirationCategories: [...state.inspirationCategories, { id: crypto.randomUUID(), name: clean, icon: "", order: state.inspirationCategories.length, createdAt: new Date().toISOString() }] };
      }),
      renameInspirationCategory: (id, name) => set((state) => {
        const clean = cleanCategoryName(name);
        const target = state.inspirationCategories.find((item) => item.id === id);
        if (!target || !clean || state.inspirationCategories.some((item) => item.id !== id && item.name.toLowerCase() === clean.toLowerCase())) return {};
        return { inspirationCategories: state.inspirationCategories.map((item) => item.id === id ? { ...item, name: clean } : item) };
      }),
      deleteInspirationCategory: (id) => set((state) => {
        const target = state.inspirationCategories.find((item) => item.id === id);
        if (!target) return {};
        return {
          inspirationCategories: state.inspirationCategories.filter((item) => item.id !== id).map((item, order) => ({ ...item, order })),
          inspirations: state.inspirations.map((item) => item.categoryId === id ? { ...item, categoryId: "" } : item),
        };
      }),
      moveInspirationCategory: (id, direction) => set((state) => {
        const ordered = [...state.inspirationCategories].sort((a, b) => a.order - b.order);
        const index = ordered.findIndex((item) => item.id === id);
        const target = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || target < 0 || target >= ordered.length) return {};
        [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
        return { inspirationCategories: ordered.map((item, order) => ({ ...item, order })) };
      }),
      addInspirationNote: (entry) => set((state) => {
        const timestamp = new Date().toISOString();
        return { inspirationNotes: [{ ...entry, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp, favorite: false, pinned: false }, ...state.inspirationNotes] };
      }),
      updateInspirationNote: (id, patch) => set((state) => ({ inspirationNotes: state.inspirationNotes.map((note) => note.id === id ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note) })),
      toggleInspirationNoteFavorite: (id) => set((state) => ({ inspirationNotes: state.inspirationNotes.map((note) => note.id === id ? { ...note, favorite: !note.favorite, updatedAt: new Date().toISOString() } : note) })),
      toggleInspirationNotePinned: (id) => set((state) => ({ inspirationNotes: state.inspirationNotes.map((note) => note.id === id ? { ...note, pinned: !note.pinned, updatedAt: new Date().toISOString() } : note) })),
      deleteInspirationNote: (id) => set((state) => ({ inspirationNotes: state.inspirationNotes.filter((note) => note.id !== id) })),
      addInspirationTag: (tag) => set((state) => {
        const clean = tag.trim();
        return clean && !state.inspirationTags.includes(clean) ? { inspirationTags: [...state.inspirationTags, clean] } : {};
      }),
      renameInspirationTag: (current, next) => set((state) => {
        const clean = next.trim();
        if (!clean || current === clean) return {};
        return {
          inspirationTags: Array.from(new Set(state.inspirationTags.map((tag) => tag === current ? clean : tag))),
          inspirationNotes: state.inspirationNotes.map((note) => ({ ...note, tags: Array.from(new Set(note.tags.map((tag) => tag === current ? clean : tag))) })),
        };
      }),
      setHabitCompletion: (habitId, date, completed) => set((state) => {
        const existing = state.habitCompletions.find((item) => item.habitId === habitId && item.date === date);
        if (existing) return { habitCompletions: state.habitCompletions.map((item) => item.id === existing.id ? { ...item, completed, updatedAt: new Date().toISOString() } : item) };
        return { habitCompletions: [...state.habitCompletions, { id: crypto.randomUUID(), habitId, date, completed, source: "manual", updatedAt: new Date().toISOString() }] };
      }),
      linkInspiration: (noteId, inspirationId) => set((state) => state.inspirationLinks.some((link) => link.noteId === noteId && link.inspirationId === inspirationId) ? {} : ({ inspirationLinks: [...state.inspirationLinks, { id: crypto.randomUUID(), noteId, inspirationId, createdAt: new Date().toISOString() }] })),
      unlinkInspiration: (noteId, inspirationId) => set((state) => ({ inspirationLinks: state.inspirationLinks.filter((link) => link.noteId !== noteId || link.inspirationId !== inspirationId) })),
      saveAIInsight: (insight) => set((state) => ({ aiInsights: [{ ...insight, id: crypto.randomUUID() }, ...state.aiInsights].slice(0, 80) })),
      addKnowledgeLink: (link) => set((state) => state.knowledgeLinks.some((item) => item.sourceId === link.sourceId && item.targetId === link.targetId) ? {} : ({ knowledgeLinks: [...state.knowledgeLinks, { ...link, id: crypto.randomUUID(), createdAt: new Date().toISOString(), source: "manual" }] })),
      deleteKnowledgeLink: (id) => set((state) => ({ knowledgeLinks: state.knowledgeLinks.filter((link) => link.id !== id) })),
      addMemory: (memory) => set((state) => {
        const timestamp = new Date().toISOString();
        return { memories: [{ ...memory, id: crypto.randomUUID(), source: memory.source ?? "user", confidence: memory.confidence ?? 100, createdAt: timestamp, updatedAt: timestamp }, ...state.memories] };
      }),
      updateMemory: (id, patch) => set((state) => ({ memories: state.memories.map((memory) => memory.id === id ? { ...memory, ...patch, updatedAt: new Date().toISOString() } : memory) })),
      deleteMemory: (id) => set((state) => ({ memories: state.memories.filter((memory) => memory.id !== id) })),
      recordUsage: (module) => set((state) => {
        const recent = state.usageEvents.at(-1);
        const now = new Date();
        if (recent?.module === module && now.getTime() - new Date(recent.occurredAt).getTime() < 30_000) return {};
        return { usageEvents: [...state.usageEvents, { id: crypto.randomUUID(), module, action: "open" as const, occurredAt: now.toISOString() }].slice(-500) };
      }),
      dismissAINotification: (notification) => set((state) => ({
        aiNotifications: [
          ...state.aiNotifications.filter((item) => item.id !== notification.id),
          { ...notification, dismissedAt: new Date().toISOString() },
        ].slice(-120),
      })),
      restoreWorkspace: (data) => set(() => normalizeWorkspaceData(data)),
      loadAccountWorkspace: (data) => set(() => normalizeWorkspaceData(data)),
      clearAccountWorkspace: () => set(cleanWorkspace()),
      updateGoals: (patch) => set((state) => ({ goals: { ...state.goals, ...patch } })),
      resetWorkspace: () => set(cleanWorkspace()),
    }),
);

export function workspaceDataFromStore(state: WorkspaceStore): WorkspaceData {
  return {
    todos: state.todos, moods: state.moods, learning: state.learning, english: state.english, fitness: state.fitness,
    weeklyReviews: state.weeklyReviews, inspirations: state.inspirations, inspirationCategories: state.inspirationCategories, inspirationNotes: state.inspirationNotes,
    inspirationTags: state.inspirationTags, habitCompletions: state.habitCompletions, inspirationLinks: state.inspirationLinks,
    aiInsights: state.aiInsights, knowledgeLinks: state.knowledgeLinks, memories: state.memories, usageEvents: state.usageEvents,
    aiNotifications: state.aiNotifications, goals: state.goals,
  };
}
