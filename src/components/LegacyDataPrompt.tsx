import { motion } from "framer-motion";
import { ArchiveRestore, ArrowRight, ShieldCheck, X } from "lucide-react";
import { useAccountData } from "../auth";

export function LegacyDataPrompt() {
  const { legacyBundle, importLegacy, dismissLegacy } = useAccountData();
  if (!legacyBundle) return null;
  const count = [legacyBundle.workspace.todos, legacyBundle.workspace.moods, legacyBundle.workspace.learning, legacyBundle.workspace.english,
    legacyBundle.workspace.fitness, legacyBundle.workspace.weeklyReviews, legacyBundle.workspace.inspirations, legacyBundle.workspace.inspirationNotes,
    legacyBundle.workspace.memories, legacyBundle.workspace.aiInsights, legacyBundle.workspace.knowledgeLinks].reduce((total, items) => total + items.length, 0);
  return <motion.aside className="legacy-migration" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
    <span><ArchiveRestore/></span><div><small>V5 LOCAL SPACE FOUND</small><strong>把原来的个人记录带入这个账户？</strong><p>检测到约 {count} 条本地记录。导入后，它们只会归属于当前登录账号。</p><i><ShieldCheck/>不会分享给其他用户</i></div>
    <button className="legacy-import" onClick={() => void importLegacy()}>安全导入<ArrowRight/></button>
    <button className="legacy-dismiss" onClick={dismissLegacy} aria-label="暂不导入"><X/></button>
  </motion.aside>;
}
