import type { LucideIcon } from "lucide-react";
import type { PageKey } from "../Shell";

export type WorkspaceNavItem = {
  id: Exclude<PageKey, "overview" | "ai">;
  label: string;
  status: string;
  icon: LucideIcon;
};
