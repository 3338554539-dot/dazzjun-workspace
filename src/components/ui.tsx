import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass-panel ${className}`}>{children}</section>;
}

export function PanelTitle({ icon: Icon, children, action }: { icon: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="panel-title"><div><Icon size={18} /><h2>{children}</h2></div>{action}</div>;
}

export function ProgressRing({ value, label = "完成进度", size = 190 }: { value: number; label?: string; size?: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="72%" outerRadius="92%" barSize={10} data={[{ value: safe, fill: "#9e79ff" }]} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "rgba(255,255,255,.07)" }} dataKey="value" cornerRadius={10} animationDuration={900} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="ring-copy"><strong><CountUp value={safe} /><small>%</small></strong><span>{label}</span></div>
    </div>
  );
}

export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 650;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / duration));
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}{suffix}</>;
}

export function FadeNotice({ children }: { children: React.ReactNode }) {
  return <motion.span className="save-notice" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{children}</motion.span>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
