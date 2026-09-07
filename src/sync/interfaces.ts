import type { WorkspaceData } from "../data/types";

export interface DazzjunUser { id: string; displayName: string; email?: string; avatarUrl?: string }
export interface UserIdentityProvider { currentUser(): Promise<DazzjunUser | null>; signIn(): Promise<DazzjunUser>; signOut(): Promise<void> }
export interface EncryptionProvider { encrypt(data: Uint8Array): Promise<Uint8Array>; decrypt(data: Uint8Array): Promise<Uint8Array> }
export interface CloudSyncSnapshot { revision: string; updatedAt: string; data: WorkspaceData }
export interface CloudSyncProvider { pull(sinceRevision?: string): Promise<CloudSyncSnapshot | null>; push(snapshot: WorkspaceData, expectedRevision?: string): Promise<CloudSyncSnapshot> }
export interface RecoveryProvider { createRecoveryPoint(data: WorkspaceData): Promise<string>; restoreRecoveryPoint(id: string): Promise<WorkspaceData> }

export type SyncStatus = "local-only" | "idle" | "syncing" | "conflict" | "error";

export interface SyncCoordinator {
  status: SyncStatus;
  sync(data: WorkspaceData): Promise<CloudSyncSnapshot>;
  resolveConflict(local: WorkspaceData, remote: CloudSyncSnapshot): Promise<WorkspaceData>;
}
