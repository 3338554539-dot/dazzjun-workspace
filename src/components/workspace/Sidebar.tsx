import {
  Brain,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Home,
  Search,
  Settings2,
} from "lucide-react";
import { motion } from "framer-motion";
import { DazzjunMark } from "../DazzjunBrand";
import type { PageKey } from "../Shell";
import type { WorkspaceNavItem } from "./types";

type SidebarProps = {
  active: PageKey;
  collapsed: boolean;
  displayName: string;
  items: WorkspaceNavItem[];
  onNavigate: (page: PageKey) => void;
  onSearch: () => void;
  onSettings: () => void;
  onAccount: () => void;
  onToggle: () => void;
};

function NavButton({ active, collapsed, icon: Icon, label, status, onClick }: {
  active: boolean;
  collapsed: boolean;
  icon: typeof Home;
  label: string;
  status?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      className={`os-sidebar-item ${active ? "active" : ""}`}
      onClick={onClick}
      whileHover={{ x: collapsed ? 0 : 2 }}
      whileTap={{ scale: .985 }}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
    >
      <Icon size={18} strokeWidth={1.65}/>
      {!collapsed && <span><strong>{label}</strong>{status && <small>{status}</small>}</span>}
    </motion.button>
  );
}

export function Sidebar({ active, collapsed, displayName, items, onNavigate, onSearch, onSettings, onAccount, onToggle }: SidebarProps) {
  const workItems = items.filter((item) => ["todo", "mood", "learning", "english", "fitness"].includes(item.id));
  const knowledgeItems = ["inspiration", "weekly"].map((id) => items.find((item) => item.id === id)).filter((item): item is WorkspaceNavItem => Boolean(item));

  return (
    <aside className={`os-sidebar ${collapsed ? "collapsed" : ""}`} aria-label="Dazzjun 主导航">
      <div className="os-sidebar-brand">
        <button onClick={() => onNavigate("overview")} aria-label="返回首页"><DazzjunMark/></button>
        {!collapsed && <span><strong>Dazzjun</strong><small>PERSONAL AI OS</small></span>}
        <button className="os-sidebar-toggle" onClick={onToggle} aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}>
          {collapsed ? <ChevronRight size={15}/> : <ChevronLeft size={15}/>}
        </button>
      </div>

      <nav className="os-sidebar-nav">
        <NavButton active={active === "overview"} collapsed={collapsed} icon={Home} label="首页" status="Personal Dashboard" onClick={() => onNavigate("overview")}/>

        <div className="os-sidebar-group">
          {!collapsed && <p>WORK & GROWTH</p>}
          {workItems.map((item) => <NavButton key={item.id} active={active === item.id} collapsed={collapsed} icon={item.icon} label={item.label} status={item.status} onClick={() => onNavigate(item.id)}/>)}
        </div>

        <div className="os-sidebar-group">
          {!collapsed && <p>KNOWLEDGE & THINKING</p>}
          {knowledgeItems.map((item) => <NavButton key={item.id} active={active === item.id} collapsed={collapsed} icon={item.icon} label={item.label} status={item.status} onClick={() => onNavigate(item.id)}/>)}
          <NavButton active={active === "ai"} collapsed={collapsed} icon={BrainCircuit} label="AI Core" status="Personal Intelligence" onClick={() => onNavigate("ai")}/>
        </div>
      </nav>

      <div className="os-sidebar-footer">
        <button onClick={onSearch} title={collapsed ? "搜索" : undefined}><Search size={17}/>{!collapsed && <span>搜索<kbd>⌘K</kbd></span>}</button>
        <button onClick={onSettings} title={collapsed ? "设置" : undefined}><Settings2 size={17}/>{!collapsed && <span>设置</span>}</button>
        <button className="os-sidebar-account" onClick={onAccount} title={collapsed ? "个人账户" : undefined} aria-label="个人账户">
          <i>{displayName.slice(0, 1).toUpperCase() || <Brain size={15}/>}</i>
          {!collapsed && <span><strong>{displayName}</strong><small>Private Workspace</small></span>}
        </button>
      </div>
    </aside>
  );
}
