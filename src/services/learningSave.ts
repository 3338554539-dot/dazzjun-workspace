import type { LearningBlock, LearningEntry } from "../data/types";

export function learningAssetIds(blocks: LearningBlock[]) {
  return [...new Set(blocks.filter((block): block is Extract<LearningBlock, { type: "image" | "file" }> => block.type === "image" || block.type === "file").map((block) => block.assetId).filter(Boolean))];
}

export function canSaveLearning(input: { uploading: boolean; uploadFailed: boolean; saving: boolean }) {
  return !input.uploading && !input.uploadFailed && !input.saving;
}

export async function saveLearningEntryConsistently(input: {
  entry: Omit<LearningEntry, "createdAt">;
  addLearning: (entry: Omit<LearningEntry, "createdAt">) => void;
  persistWorkspace: () => Promise<void>;
  confirmAssets: (learningId: string, assetIds: string[]) => Promise<unknown>;
}) {
  input.addLearning(input.entry);
  await input.persistWorkspace();
  const assetIds = learningAssetIds(input.entry.learningBlocks || []);
  if (assetIds.length) await input.confirmAssets(input.entry.id, assetIds);
  return { entryId: input.entry.id, assetIds };
}
