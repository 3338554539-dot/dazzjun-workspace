export type TodoCategory = "工作" | "学习" | "生活";
export type Priority = "高" | "中" | "低";
export type MoodKind = "低落" | "疲惫" | "平静" | "开心" | "兴奋";
export type LearningCategory = "书籍" | "课程" | "技能" | "文章";
export type EnglishCategory = "单词" | "听力" | "阅读" | "口语";
export type InspirationPlatform = "douyin" | "xiaohongshu" | "web";
export type InspirationPortal = "抖音" | "小红书";
export type InspirationCoverType = "video_first_frame" | "video_poster" | "first_image" | "og_image" | "main_image" | "fallback";
export type HabitId = "reading" | "english" | "fitness" | "writing" | "sleep";
export type AIInsightType = "daily" | "weekly" | "monthly" | "annual" | "inspiration" | "growth";
export type MemoryKind = "Preference" | "Interest" | "Habit" | "Goal" | "History";
export type MemoryTier = "short" | "long" | "knowledge";
export type KnowledgeNodeType = "note" | "learning" | "inspiration" | "weekly" | "english";
export type WorkspaceModule = "overview" | "todo" | "mood" | "learning" | "english" | "fitness" | "weekly" | "inspiration" | "ai";
export type AINotificationSeverity = "info" | "attention" | "care" | "growth";

export interface TodoItem {
  id: string;
  title: string;
  category: TodoCategory;
  priority: Priority;
  scheduleDate: string;
  startAt: string;
  deadline: string;
  done: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface MoodEntry {
  id: string;
  date: string;
  mood: MoodKind;
  score: number;
  story: string;
  note: string;
  updatedAt: string;
}

export interface LearningTextBlock {
  id: string;
  type: "text";
  content: string;
}

export interface LearningImageBlock {
  id: string;
  assetId: string;
  type: "image";
  url: string;
  thumbnail: string;
  name: string;
  size: number;
  mime: string;
  createdAt: string;
}

export interface LearningFileBlock {
  id: string;
  assetId: string;
  type: "file";
  url: string;
  name: string;
  size: number;
  mime: string;
  createdAt: string;
}

export interface LearningLinkBlock {
  id: string;
  type: "link";
  url: string;
  title: string;
  favicon: string;
  siteName: string;
  description: string;
}

export type LearningBlock = LearningTextBlock | LearningImageBlock | LearningFileBlock | LearningLinkBlock;

export interface LearningEntry {
  id: string;
  date: string;
  title: string;
  category: LearningCategory;
  content: string;
  duration: number;
  notes: string;
  gain: string;
  learningBlocks?: LearningBlock[];
  createdAt: string;
}

export interface EnglishEntry {
  id: string;
  date: string;
  checkedIn: boolean;
  duration: number;
  words: number;
  exercises: number;
  categories: EnglishCategory[];
  note: string;
  updatedAt: string;
}

export interface FitnessEntry {
  id: string;
  date: string;
  title: string;
  duration: number;
  calories: number;
  plan: string;
  completed: boolean;
  createdAt: string;
}

export interface WeeklyReview {
  id: string;
  weekKey: string;
  start: string;
  end: string;
  weekNumber: number;
  completed: string;
  obstacles: string;
  improvements: string;
  highlights: string;
  updatedAt: string;
}

export interface InspirationItem {
  id: string;
  platform: InspirationPlatform;
  portal: InspirationPortal;
  title: string;
  cover: string;
  coverSource?: string;
  coverType?: InspirationCoverType;
  author: string;
  sourceText: string;
  categoryName: string;
  aiTags: string[];
  // Legacy aliases keep existing records, search and backup exports compatible.
  content: string;
  image: string;
  url: string;
  categoryId: string;
  createdAt: string;
  saved: boolean;
}

export interface InspirationCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
  createdAt: string;
}

export interface InspirationNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  pinned: boolean;
}

export interface HabitCompletion {
  id: string;
  habitId: HabitId;
  date: string;
  completed: boolean;
  source: "manual" | "module";
  updatedAt: string;
}

export interface InspirationLink {
  id: string;
  noteId: string;
  inspirationId: string;
  createdAt: string;
}

export interface AIInsightSection {
  title: string;
  content: string;
}

export interface AIInsightRecord {
  id: string;
  type: AIInsightType;
  title: string;
  summary: string;
  sections: AIInsightSection[];
  generatedAt: string;
  engine: "local-insight" | "provider";
  provider?: string;
  model?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface KnowledgeLink {
  id: string;
  sourceId: string;
  sourceType: KnowledgeNodeType;
  targetId: string;
  targetType: KnowledgeNodeType;
  relation: string;
  createdAt: string;
  source: "manual" | "automatic";
}

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  title: string;
  value: string;
  source: "user" | "inferred";
  confidence: number;
  createdAt: string;
  updatedAt: string;
  tier?: MemoryTier;
}

export interface WorkspaceUsageEvent {
  id: string;
  module: WorkspaceModule;
  action: "open";
  occurredAt: string;
}

export interface AINotificationRecord {
  id: string;
  rule: string;
  severity: AINotificationSeverity;
  title: string;
  message: string;
  action: string;
  target: WorkspaceModule;
  createdAt: string;
  dismissedAt?: string;
}

export interface PerceptionSnapshot {
  generatedAt: string;
  windowDays: number;
  openCount: number;
  activeModules: number;
  topModule: WorkspaceModule;
  taskCompletion: number;
  learningMinutes: number;
  englishMinutes: number;
  fitnessSessions: number;
  moodAverage: number;
  inspirationCount: number;
  habitContinuity: number;
  signals: Array<{ label: string; value: string; tone: "stable" | "rising" | "attention" }>;
}

export interface GrowthGoals {
  weeklyTodoTarget: number;
  weeklyLearningMinutes: number;
  weeklyEnglishMinutes: number;
  weeklyFitnessSessions: number;
  monthlyInspirationTarget: number;
}

export interface WorkspaceData {
  todos: TodoItem[];
  moods: MoodEntry[];
  learning: LearningEntry[];
  english: EnglishEntry[];
  fitness: FitnessEntry[];
  weeklyReviews: WeeklyReview[];
  inspirations: InspirationItem[];
  inspirationCategories: InspirationCategory[];
  inspirationNotes: InspirationNote[];
  inspirationTags: string[];
  habitCompletions: HabitCompletion[];
  inspirationLinks: InspirationLink[];
  aiInsights: AIInsightRecord[];
  knowledgeLinks: KnowledgeLink[];
  memories: MemoryItem[];
  usageEvents: WorkspaceUsageEvent[];
  aiNotifications: AINotificationRecord[];
  goals: GrowthGoals;
}
