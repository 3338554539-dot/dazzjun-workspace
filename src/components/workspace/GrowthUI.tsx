import type { LucideIcon } from "lucide-react";
import { ArrowRight, Plus } from "lucide-react";

export function PageContextHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="growth-context-header"><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action}</header>;
}

export interface StatusMetric { label: string; value: React.ReactNode; detail: string; tone?: "violet" | "green" | "yellow" }

export function StatusStrip({ items }: { items: StatusMetric[] }) {
  return <section className="growth-status-strip" aria-label="页面摘要">{items.map((item) => <div key={item.label} className={item.tone ? `tone-${item.tone}` : ""}><small>{item.label}</small><strong>{item.value}</strong><span>{item.detail}</span></div>)}</section>;
}

export function SectionHeader({ icon: Icon, eyebrow, title, action }: { icon?: LucideIcon; eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <header className="growth-section-header"><div>{Icon && <Icon size={16}/>}<span>{eyebrow && <small>{eyebrow}</small>}<h3>{title}</h3></span></div>{action}</header>;
}

export function WorkspaceEmptyState({ icon: Icon, title, description, action, onAction }: { icon: LucideIcon; title: string; description: string; action: string; onAction: () => void }) {
  return <div className="growth-empty"><Icon size={25}/><strong>{title}</strong><span>{description}</span><button onClick={onAction}><Plus size={14}/>{action}</button></div>;
}

export function TimelineGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="growth-timeline-group"><h4>{title}</h4><div>{children}</div></section>;
}

export function RailCTA({ icon: Icon, title, description, onClick }: { icon: LucideIcon; title: string; description: string; onClick: () => void }) {
  return <button className="growth-rail-cta" onClick={onClick}><Icon size={18}/><span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={15}/></button>;
}
