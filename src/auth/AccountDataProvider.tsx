import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { preferenceApi, workspaceApi } from "../api/client";
import { normalizeWorkspaceData } from "../data/defaults";
import type { WorkspaceData } from "../data/types";
import type { SyncStatus } from "../models/user";
import { useWorkspaceStore, workspaceDataFromStore } from "../store/workspaceStore";
import { useThemeStore, type ThemeId, type WorkspaceTheme } from "../theme";
import { useAuth } from "./AuthProvider";

type LegacyBundle = { workspace: WorkspaceData; themeId: ThemeId; customThemes: WorkspaceTheme[] };
type AccountDataContextValue = { ready: boolean; syncStatus: SyncStatus; lastSavedAt: string; error: string; legacyBundle: LegacyBundle | null; retry: () => Promise<void>; saveWorkspaceNow: () => Promise<void>; importLegacy: () => Promise<void>; dismissLegacy: () => void };
const AccountDataContext = createContext<AccountDataContextValue | null>(null);

function hasRecords(data: WorkspaceData) {
  return data.todos.length + data.moods.length + data.learning.length + data.english.length + data.fitness.length + data.weeklyReviews.length + data.inspirations.length + data.inspirationNotes.length + data.memories.length > 0;
}

function readLegacyBundle(): LegacyBundle | null {
  try {
    const workspaceRaw = localStorage.getItem("dazzjun.workspace.v2");
    if (!workspaceRaw) return null;
    const workspaceState = JSON.parse(workspaceRaw)?.state as Partial<WorkspaceData> | undefined;
    const workspace = normalizeWorkspaceData(workspaceState ?? {});
    if (!hasRecords(workspace)) return null;
    const themeState = JSON.parse(localStorage.getItem("dazzjun.theme.v1") || "{}")?.state ?? {};
    return { workspace, themeId: themeState.themeId ?? "cosmic", customThemes: themeState.customThemes ?? [] };
  } catch { return null; }
}

export function AccountDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [error, setError] = useState("");
  const [legacyBundle, setLegacyBundle] = useState<LegacyBundle | null>(null);
  const generation = useRef(0);
  const workspaceTimer = useRef(0);

  const load = useCallback(async () => {
    if (!user) return;
    const current = ++generation.current; setReady(false); setSyncStatus("loading"); setError("");
    try {
      const [workspace, preferences] = await Promise.all([workspaceApi.get(), preferenceApi.get()]);
      if (current !== generation.current) return;
      const normalized = normalizeWorkspaceData(workspace.data);
      let workspaceUpdatedAt = workspace.updatedAt;
      if (JSON.stringify(normalized) !== JSON.stringify(workspace.data)) {
        const migrated = await workspaceApi.save(normalized);
        if (current !== generation.current) return;
        workspaceUpdatedAt = migrated.updatedAt;
      }
      useWorkspaceStore.getState().loadAccountWorkspace(normalized);
      useThemeStore.getState().loadAccountTheme(preferences.themeId, preferences.customThemes);
      const marker = localStorage.getItem(`dazzjun.v6.migration.${user.id}`);
      setLegacyBundle(!marker && !hasRecords(normalized) ? readLegacyBundle() : null);
      setLastSavedAt(workspaceUpdatedAt); setReady(true); setSyncStatus("saved");
    } catch (cause) {
      if (current !== generation.current) return;
      setError(cause instanceof Error ? cause.message : "无法加载个人空间"); setSyncStatus("error");
    }
  }, [user]);

  useEffect(() => { void load(); return () => { generation.current += 1; window.clearTimeout(workspaceTimer.current); useWorkspaceStore.getState().clearAccountWorkspace(); useThemeStore.getState().clearAccountTheme(); }; }, [load]);

  const saveWorkspaceNow = useCallback(async () => {
    if (!ready || !user) throw new Error("个人空间尚未准备完成");
    window.clearTimeout(workspaceTimer.current);
    setSyncStatus("saving"); setError("");
    try {
      const result = await workspaceApi.save(workspaceDataFromStore(useWorkspaceStore.getState()));
      setLastSavedAt(result.updatedAt); setSyncStatus("saved");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "保存失败";
      setError(message); setSyncStatus(message.includes("连接") || message.includes("超时") ? "offline" : "error");
      throw cause;
    }
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !user) return;
    let themeTimer = 0; let active = true;
    const saveWorkspace = () => {
      window.clearTimeout(workspaceTimer.current); setSyncStatus("saving");
      workspaceTimer.current = window.setTimeout(() => { if (active) void saveWorkspaceNow().catch(() => {}); }, 650);
    };
    const saveTheme = () => {
      window.clearTimeout(themeTimer); setSyncStatus("saving");
      themeTimer = window.setTimeout(async () => {
        const state = useThemeStore.getState();
        try { const result = await preferenceApi.save({ themeId: state.themeId, customThemes: state.customThemes }); if (active) { setLastSavedAt(result.updatedAt); setSyncStatus("saved"); } }
        catch (cause) { if (active) { setError(cause instanceof Error ? cause.message : "主题保存失败"); setSyncStatus("error"); } }
      }, 500);
    };
    const unsubscribeWorkspace = useWorkspaceStore.subscribe((state, previous) => { if (workspaceDataFromStore(state) !== workspaceDataFromStore(previous)) saveWorkspace(); });
    const unsubscribeTheme = useThemeStore.subscribe((state, previous) => { if (state.themeId !== previous.themeId || state.customThemes !== previous.customThemes) saveTheme(); });
    return () => { active = false; unsubscribeWorkspace(); unsubscribeTheme(); window.clearTimeout(workspaceTimer.current); window.clearTimeout(themeTimer); };
  }, [ready, user, saveWorkspaceNow]);

  const importLegacy = async () => {
    if (!legacyBundle || !user) return;
    setSyncStatus("saving");
    const normalized = normalizeWorkspaceData(legacyBundle.workspace);
    const [workspaceResult, themeResult] = await Promise.all([workspaceApi.save(normalized), preferenceApi.save({ themeId: legacyBundle.themeId, customThemes: legacyBundle.customThemes })]);
    useWorkspaceStore.getState().loadAccountWorkspace(normalized); useThemeStore.getState().loadAccountTheme(legacyBundle.themeId, legacyBundle.customThemes);
    localStorage.setItem(`dazzjun.v6.migration.${user.id}`, "imported"); setLegacyBundle(null); setLastSavedAt(workspaceResult.updatedAt || themeResult.updatedAt); setSyncStatus("saved");
  };
  const dismissLegacy = () => { if (user) localStorage.setItem(`dazzjun.v6.migration.${user.id}`, "skipped"); setLegacyBundle(null); };

  const value = useMemo(() => ({ ready, syncStatus, lastSavedAt, error, legacyBundle, retry: load, saveWorkspaceNow, importLegacy, dismissLegacy }), [ready, syncStatus, lastSavedAt, error, legacyBundle, load, saveWorkspaceNow]);
  return <AccountDataContext.Provider value={value}>{children}</AccountDataContext.Provider>;
}

export function useAccountData() {
  const context = useContext(AccountDataContext);
  if (!context) throw new Error("useAccountData must be used inside AccountDataProvider");
  return context;
}
