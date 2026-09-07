import { AnimatePresence, motion } from "framer-motion";
import { Check, KeyRound, LogOut, Save, ShieldCheck, UserRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAccountData, useAuth } from "../auth";
import { useWorkspaceStats } from "../hooks/useWorkspaceStats";
import { useWorkspaceTheme } from "../theme";
import { DazzjunMark } from "./DazzjunBrand";

export function ProfilePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const { syncStatus, lastSavedAt } = useAccountData();
  const stats = useWorkspaceStats(); const theme = useWorkspaceTheme();
  const [tab, setTab] = useState<"profile" | "security">("profile");
  const [displayName, setDisplayName] = useState(user?.displayName ?? ""); const [bio, setBio] = useState(user?.bio ?? "");
  const [currentPassword, setCurrentPassword] = useState(""); const [nextPassword, setNextPassword] = useState("");
  const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { setDisplayName(user?.displayName ?? ""); setBio(user?.bio ?? ""); }, [user]);
  if (!user) return null;

  const saveProfile = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setNotice(""); try { await updateProfile({ displayName, bio }); setNotice("个人主页已更新"); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "更新失败"); } finally { setBusy(false); } };
  const savePassword = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setNotice(""); try { await changePassword(currentPassword, nextPassword); setCurrentPassword(""); setNextPassword(""); setNotice("密码已安全更新"); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "更新失败"); } finally { setBusy(false); } };
  const syncCopy = syncStatus === "saved" ? "已同步" : syncStatus === "saving" ? "同步中" : syncStatus === "offline" ? "离线" : "需检查";

  return <AnimatePresence>{open && <motion.aside className="profile-panel" initial={{ opacity: 0, y: -10, scale: .98, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -7, scale: .985 }}>
    <header><span className="profile-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt=""/> : user.displayName.slice(0, 1).toUpperCase()}</span><div><small>DAZZJUN IDENTITY</small><strong>{user.displayName}</strong><em>{user.email}</em></div><button onClick={onClose} aria-label="关闭个人主页"><X/></button></header>
    <section className="profile-world"><DazzjunMark/><span><small>CURRENT WORLD</small><strong>{theme.name}</strong><em>{theme.eyebrow}</em></span><i><Check/>{syncCopy}</i></section>
    <div className="profile-metrics"><span><strong>{stats.todo.done}</strong><small>完成任务</small></span><span><strong>{stats.learningMinutes}</strong><small>学习分钟</small></span><span><strong>{stats.fitness.sessions}</strong><small>本周运动</small></span><span><strong>{stats.inspirationSaved}</strong><small>灵感收藏</small></span></div>
    <nav><button className={tab === "profile" ? "active" : ""} onClick={() => { setTab("profile"); setNotice(""); }}><UserRound/>个人主页</button><button className={tab === "security" ? "active" : ""} onClick={() => { setTab("security"); setNotice(""); }}><KeyRound/>账户安全</button></nav>
    {tab === "profile" ? <form onSubmit={saveProfile}><label>用户名称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={30}/></label><label>个性签名<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={120} placeholder="写下一句此刻的自我描述…"/></label><button className="profile-save" disabled={busy}><Save/>保存个人主页</button></form> : <form onSubmit={savePassword}><label>当前密码<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required/></label><label>新密码<input type="password" autoComplete="new-password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} minLength={8} required/></label><button className="profile-save" disabled={busy}><ShieldCheck/>更新密码</button></form>}
    {notice && <p className="profile-notice">{notice}</p>}
    <footer><span><ShieldCheck/>账户数据完全隔离<small>{lastSavedAt ? `最近同步 ${new Date(lastSavedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "等待首次同步"}</small></span><button onClick={() => void logout()}><LogOut/>退出登录</button></footer>
  </motion.aside>}</AnimatePresence>;
}
