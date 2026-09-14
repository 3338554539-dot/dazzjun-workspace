import { BrainCircuit, ChevronUp, CircleEllipsis, Home, PenLine, Settings2, SquareCheckBig, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { PageKey } from "../Shell";
import type { WorkspaceNavigate } from "./WorkspaceNavigation";

export function MobileNavigation({ active, onNavigate, onAccount, onSettings }: { active: PageKey; onNavigate: WorkspaceNavigate; onAccount: () => void; onSettings: () => void }) {
  const [menu, setMenu] = useState<"record" | "more" | null>(null);
  const go = (page: PageKey) => { onNavigate(page); setMenu(null); };
  return (
    <>
      <AnimatePresence>{menu && <motion.div className="os-mobile-sheet" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}>
        <span>{menu === "record" ? "快速记录" : "更多空间"}</span>
        <div>{menu === "record" ? <>
          <button onClick={() => { onNavigate("mood", { mode: "new" }); setMenu(null); }}>心情</button>
          <button onClick={() => { onNavigate("learning", { mode: "new" }); setMenu(null); }}>学习</button>
          <button onClick={() => { onNavigate("english", { mode: "new" }); setMenu(null); }}>英语</button>
          <button onClick={() => { onNavigate("fitness", { mode: "new" }); setMenu(null); }}>健身</button>
          <button onClick={() => { onNavigate("inspiration", { mode: "capture" }); setMenu(null); }}>灵感</button>
        </> : <>
          <button className="os-mobile-account" onClick={() => { onAccount(); setMenu(null); }}><UserRound size={15}/>个人账户</button>
          <button onClick={() => { onSettings(); setMenu(null); }}><Settings2 size={15}/>设置</button>
          <button onClick={() => go("weekly")}>周复盘</button>
          <button onClick={() => go("inspiration")}>灵感库</button>
          <button onClick={() => go("learning")}>学习日志</button>
          <button onClick={() => go("fitness")}>健身锻炼</button>
        </>}</div>
      </motion.div>}</AnimatePresence>
      <nav className="os-mobile-nav" aria-label="移动端主导航">
        <button className={active === "overview" ? "active" : ""} onClick={() => go("overview")}><Home size={19}/><span>首页</span></button>
        <button className={active === "todo" ? "active" : ""} onClick={() => go("todo")}><SquareCheckBig size={19}/><span>任务</span></button>
        <button className={menu === "record" ? "active" : ""} onClick={() => setMenu(menu === "record" ? null : "record")}><PenLine size={19}/><span>记录</span></button>
        <button className={active === "ai" ? "active" : ""} onClick={() => go("ai")}><BrainCircuit size={19}/><span>AI</span></button>
        <button className={menu === "more" ? "active" : ""} onClick={() => setMenu(menu === "more" ? null : "more")}><CircleEllipsis size={19}/><span>更多</span>{menu === "more" && <ChevronUp size={10}/>}</button>
      </nav>
    </>
  );
}
