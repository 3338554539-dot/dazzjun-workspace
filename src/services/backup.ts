import type { WorkspaceData } from "../data/types";
import { normalizeWorkspaceData } from "../data/defaults";

export interface DazzjunBackup {
  product: "Dazzjun工作台";
  schemaVersion: 6;
  exportedAt: string;
  data: WorkspaceData;
}

export function exportWorkspaceBackup(data: WorkspaceData) {
  const backup: DazzjunBackup = { product: "Dazzjun工作台", schemaVersion: 6, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "Dazzjun_backup.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseWorkspaceBackup(text: string): WorkspaceData {
  const parsed = JSON.parse(text) as Partial<DazzjunBackup>;
  if (parsed.product !== "Dazzjun工作台" || !parsed.data || !Array.isArray(parsed.data.todos)) throw new Error("这不是有效的 Dazzjun 数据备份。");
  const data = parsed.data as Partial<WorkspaceData>;
  return normalizeWorkspaceData(data);
}
