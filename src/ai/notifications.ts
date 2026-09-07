import type { AINotificationRecord, PerceptionSnapshot, WorkspaceData } from "../data/types";
import { todayISO } from "../services/date";
import { getTodayTasks } from "../services/todoSelectors";

type ActiveNotice = Omit<AINotificationRecord, "dismissedAt">;

export function buildAINotifications(snapshot: PerceptionSnapshot, data: WorkspaceData): ActiveNotice[] {
  const date = todayISO();
  const notices: ActiveNotice[] = [];
  const add = (notice: Omit<ActiveNotice, "id" | "createdAt">) => notices.push({ ...notice, id: `${notice.rule}:${date}`, createdAt: new Date().toISOString() });

  if (snapshot.fitnessSessions < data.goals.weeklyFitnessSessions) add({ rule: "fitness-gap", severity: "care", title: "身体节奏需要一点空间", message: `最近 ${snapshot.windowDays} 天完成 ${snapshot.fitnessSessions} 次运动，距离目标还有 ${data.goals.weeklyFitnessSessions - snapshot.fitnessSessions} 次。`, action: "安排一次轻量训练", target: "fitness" });
  if (snapshot.learningMinutes < data.goals.weeklyLearningMinutes) add({ rule: "learning-gap", severity: "growth", title: "学习投入低于本周目标", message: `当前学习 ${snapshot.learningMinutes} 分钟，建议把剩余时间拆成两个不被打扰的专注块。`, action: "打开学习日志", target: "learning" });
  if (snapshot.englishMinutes < Math.round(data.goals.weeklyEnglishMinutes * .65)) add({ rule: "english-rhythm", severity: "attention", title: "英语节奏出现下降信号", message: `最近 ${snapshot.windowDays} 天英语学习 ${snapshot.englishMinutes} 分钟，可以从一次 20 分钟听力重新启动。`, action: "恢复英语训练", target: "english" });
  const urgent = getTodayTasks(data.todos, date).filter((item) => !item.done && item.priority === "高");
  if (urgent.length) add({ rule: "priority-focus", severity: "info", title: "先保护最重要的一件事", message: `还有 ${urgent.length} 项高优先级任务待完成：${urgent[0].title}。`, action: "查看今日任务", target: "todo" });
  if (snapshot.moodAverage && snapshot.moodAverage < 55) add({ rule: "mood-care", severity: "care", title: "近期能量偏低", message: "系统感知到情绪评分有所下降，今天可以主动减少一项非必要安排。", action: "记录当前感受", target: "mood" });

  return notices;
}

export function visibleAINotifications(generated: ActiveNotice[], saved: AINotificationRecord[]) {
  const dismissed = new Set(saved.filter((item) => item.dismissedAt).map((item) => item.id));
  return generated.filter((item) => !dismissed.has(item.id));
}

export interface NotificationProvider {
  publish(notifications: ActiveNotice[]): Promise<void>;
}
