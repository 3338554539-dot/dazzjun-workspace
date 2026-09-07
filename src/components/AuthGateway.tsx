import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Smartphone, Sparkles, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth";
import { DazzjunMark } from "./DazzjunBrand";

type Mode = "login" | "register";

export function AuthGateway() {
  const { login, register, error: sessionError, retrySession } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.info(`LOGIN_PAGE_MOUNT\npathname: ${window.location.pathname}\ntime: ${new Date().toISOString()}`);
    return () => console.info(`LOGIN_PAGE_UNMOUNT\npathname: ${window.location.pathname}\ntime: ${new Date().toISOString()}`);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { if (mode === "login") await login(email, password); else await register(email, password, displayName); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "暂时无法进入空间"); }
    finally { setBusy(false); }
  };

  const switchMode = (next: Mode) => { setMode(next); setError(""); setPassword(""); };

  return <main className="auth-space">
    <img className="auth-wallpaper" src="/assets/dazzjun-orbit-hero.png" alt="Dazzjun 抽象星环与未来城市空间"/>
    <div className="auth-veil"/>
    <section className="auth-story">
      <div className="auth-brand"><DazzjunMark/><span><strong>Dazzjun</strong><small>MULTI USER PERSONAL OS</small></span></div>
      <div className="auth-copy"><span>YOUR PRIVATE DIGITAL UNIVERSE</span><h1>每个人，都拥有一座<br/>自己的数字宇宙。</h1><p>任务、情绪、学习、身体、灵感与 AI Memory，被安静地组织在只属于你的空间里。</p></div>
      <div className="auth-principles"><span><ShieldCheck/>账户数据隔离</span><span><LockKeyhole/>私密 Session</span><span><Sparkles/>独立主题与记忆</span></div>
      <footer><i/>DAZZJUN PLATFORM · V7.0</footer>
    </section>

    <section className="auth-panel-wrap">
      <motion.div className="auth-panel" initial={{ opacity: 0, y: 18, filter: "blur(12px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: .6, ease: [0.22, 1, 0.36, 1] }}>
        <header><span><DazzjunMark/><i><small>WELCOME TO</small><strong>Dazzjun Space</strong></i></span><b>PRIVATE ACCESS</b></header>
        <nav aria-label="账户入口"><button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>登录</button><button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>创建账户</button></nav>
        <AnimatePresence mode="wait"><motion.form key={mode} onSubmit={submit} initial={{ opacity: 0, x: mode === "login" ? -8 : 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: .24 }}>
          <div className="auth-form-heading"><h2>{mode === "login" ? "回到你的空间" : "开始一座新宇宙"}</h2><p>{mode === "login" ? "继续今天的记录与成长。" : "每个账户都拥有完全独立的数据空间。"}</p></div>
          {mode === "register" && <label><span>你的名称</span><div><UserRound/><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="朋友如何称呼你" required minLength={2} maxLength={30}/></div></label>}
          <label><span>邮箱</span><div><Mail/><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required/></div></label>
          <label><span>密码</span><div><KeyRound/><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "login" ? "输入你的密码" : "至少 8 位"} required minLength={8}/><button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff/> : <Eye/>}</button></div></label>
          {(error || sessionError) && <p className="auth-error">{error || sessionError}{sessionError && <button type="button" onClick={() => void retrySession()}>重新连接</button>}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? <span className="auth-spinner"/> : <>{mode === "login" ? "进入我的空间" : "创建独立空间"}<ArrowRight/></>}</button>
          <div className="auth-divider"><span>更多登录方式正在准备</span></div>
          <div className="auth-future"><button type="button" disabled><Smartphone/>手机登录<small>即将开放</small></button><button type="button" disabled><DazzjunMark/>第三方账户<small>接口已预留</small></button></div>
        </motion.form></AnimatePresence>
        <footer><ShieldCheck/><span><strong>你的数据只属于当前账户</strong><small>Session Cookie · 用户级权限验证 · 独立数据库空间</small></span><Check/></footer>
      </motion.div>
    </section>
  </main>;
}

export function PlatformLoading({ message = "正在确认你的私人空间" }: { message?: string }) {
  return <main className="platform-loading"><div><DazzjunMark/><span className="platform-orbit"/><strong>{message}</strong><small>DAZZJUN PERSONAL OS</small></div></main>;
}
