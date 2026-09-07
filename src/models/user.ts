export interface DazzjunUser {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
export type SyncStatus = "loading" | "saved" | "saving" | "offline" | "error";
