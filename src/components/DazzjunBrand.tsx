import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function IconFrame({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} {...props}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function DazzjunMark({ title, ...props }: IconProps) {
  return (
    <IconFrame title={title} {...props}>
      <path d="M9 7.25v17.5h5.15c6.03 0 9.85-3.27 9.85-8.75s-3.82-8.75-9.85-8.75H9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.5 11.25h.65c3.5 0 5.6 1.64 5.6 4.75s-2.1 4.75-5.6 4.75h-.65" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M4.55 17.25c3.3-4.18 9.53-7.63 16.16-7.28 4.08.21 6.53 1.63 6.83 3.48.46 2.85-4.27 6.19-10.56 7.46-4.92 1-9.43.32-11.18-1.48" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity=".72"/>
      <circle cx="25.25" cy="9.15" r="1.65" fill="currentColor"/>
      <circle cx="5.2" cy="19.45" r=".75" fill="currentColor" opacity=".72"/>
    </IconFrame>
  );
}

export function ArchiveNodeIcon({ title, ...props }: IconProps) {
  return (
    <IconFrame title={title} {...props}>
      <path d="M7.5 9.5 16 5l8.5 4.5v12L16 26l-8.5-4.5v-12Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" opacity=".55"/>
      <path d="M16 8.25v11.5m0 0-3.4-3.4m3.4 3.4 3.4-3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.25 23h9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="8.05" cy="13" r=".85" fill="currentColor" opacity=".8"/>
      <circle cx="23.95" cy="17.4" r=".7" fill="currentColor" opacity=".55"/>
    </IconFrame>
  );
}

export function CaptureNodeIcon({ title, ...props }: IconProps) {
  return (
    <IconFrame title={title} {...props}>
      <path d="M7.5 10.5 16 6l8.5 4.5v11L16 26l-8.5-4.5v-11Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" opacity=".55"/>
      <path d="M16 22.5V11m0 0-3.4 3.4M16 11l3.4 3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.25 8.75h9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="8.2" cy="18.65" r=".85" fill="currentColor" opacity=".8"/>
      <circle cx="23.8" cy="13.4" r=".7" fill="currentColor" opacity=".55"/>
    </IconFrame>
  );
}

export function IntelligenceNodeIcon({ title, ...props }: IconProps) {
  return (
    <IconFrame title={title} {...props}>
      <path d="M16 23.75a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z" fill="currentColor"/>
      <path d="M10.1 18.4a8.3 8.3 0 0 1 11.8 0M7.05 14.85a12.65 12.65 0 0 1 17.9 0M11.3 24.8h9.4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M16 5.4v2.35M6.55 8.9l1.7 1.6M25.45 8.9l-1.7 1.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity=".6"/>
      <circle cx="16" cy="20.65" r="5.15" stroke="currentColor" strokeWidth=".9" opacity=".25"/>
    </IconFrame>
  );
}

export function SpaceSwitchIcon({ title, ...props }: IconProps) {
  return (
    <IconFrame title={title} {...props}>
      <path d="M8.25 13.25 16 19.8l7.75-6.55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.6 9.5 16 14.05 21.4 9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" opacity=".52"/>
      <path d="M7.25 22.6c2.35 1.55 5.4 2.4 8.75 2.4s6.4-.85 8.75-2.4" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity=".35"/>
    </IconFrame>
  );
}

export function SearchNodeIcon({ title, ...props }: IconProps) {
  return (
    <IconFrame title={title} {...props}>
      <circle cx="14.2" cy="14.2" r="7.2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="m19.6 19.6 5.15 5.15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="14.2" cy="14.2" r="2" fill="currentColor" opacity=".36"/>
    </IconFrame>
  );
}

