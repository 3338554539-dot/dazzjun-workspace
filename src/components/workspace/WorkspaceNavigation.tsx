import { createContext, useContext } from "react";
import type { PageKey } from "../Shell";

export type WorkspaceNavigationOptions = Record<string, string | number | boolean | null | undefined>;
export type WorkspaceNavigate = (page: PageKey, options?: WorkspaceNavigationOptions) => void;

const WorkspaceNavigationContext = createContext<{
  active: PageKey;
  navigate: WorkspaceNavigate;
  params: URLSearchParams;
} | null>(null);

export function WorkspaceNavigationProvider({ active, navigate, locationKey, children }: {
  active: PageKey;
  navigate: WorkspaceNavigate;
  locationKey: string;
  children: React.ReactNode;
}) {
  return <WorkspaceNavigationContext.Provider value={{ active, navigate, params: new URLSearchParams(locationKey.split("?")[1] ?? "") }}>{children}</WorkspaceNavigationContext.Provider>;
}

export function useWorkspaceNavigation() {
  const value = useContext(WorkspaceNavigationContext);
  if (!value) throw new Error("useWorkspaceNavigation must be used inside WorkspaceNavigationProvider");
  return value;
}
