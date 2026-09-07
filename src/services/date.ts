export function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function displayDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function shortDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function weekMeta(dateInput: Date | string = new Date(), offset = 0) {
  const date = typeof dateInput === "string" ? new Date(`${dateInput}T12:00:00`) : new Date(dateInput);
  const weekday = date.getDay() || 7;
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(date.getDate() - weekday + 1 + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const firstThursday = new Date(monday.getFullYear(), 0, 4);
  const firstDay = firstThursday.getDay() || 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 1);
  const weekNumber = 1 + Math.round((monday.getTime() - firstThursday.getTime()) / 604800000);
  const start = toISODate(monday);
  const end = toISODate(sunday);
  return { start, end, weekNumber, weekKey: start };
}

export function isBetween(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export function daysAgoISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toISODate(date);
}

export function monthKey(iso = todayISO()) {
  return iso.slice(0, 7);
}

export function getGreeting(hour = new Date().getHours()) {
  if (hour < 12) return "Good Morning, Dazzjun";
  if (hour < 18) return "Good Afternoon, Dazzjun";
  return "Good Evening, Dazzjun";
}
