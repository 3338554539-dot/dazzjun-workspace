type SchedulableTask = { scheduleDate?: unknown };

export function getTodayTasks<T extends SchedulableTask>(tasks: T[], today: string): T[] {
  return tasks.filter((task) => task.scheduleDate === today);
}

export function dateInTimeZone(now: Date, timeZone = "Asia/Shanghai"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
