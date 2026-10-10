// 设置弹窗左侧导航的图标（从 SettingsDialog 拆出来，那个文件逼近 380 行上限）。
import type { SVGProps } from "react";

export function IconKey(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M14.5 9.5a4 4 0 1 1-1.2 2.86L5 20.65 3.35 19 11.6 10.7A4 4 0 0 1 14.5 9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
export function IconBook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5.5 5.2A2.2 2.2 0 0 1 7.7 3H19v15.5H7.7a2.2 2.2 0 0 0-2.2 2.2V5.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.5 5.2A2.2 2.2 0 0 0 3.3 3H3v15.5h.3a2.2 2.2 0 0 1 2.2 2.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
export function IconSync(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M19.5 9A7.5 7.5 0 0 0 6 6.6L4.5 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 4v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 15A7.5 7.5 0 0 0 18 17.4l1.5-1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 20v-4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4.5 19.5h15M7.5 16v-4M12 16V8M16.5 16v-6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconArchive(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3.5" y="4" width="17" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 12.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
export function IconPalette(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3a9 9 0 1 0 9 9c0-.5-.04-1-.12-1.48a5 5 0 0 1-6.4-6.4A9 9 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="8.5" cy="10" r="1.1" fill="currentColor" />
      <circle cx="11.5" cy="7.2" r="1.1" fill="currentColor" />
      <circle cx="15.2" cy="9" r="1.1" fill="currentColor" />
    </svg>
  );
}
export function IconUpdate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 5v2.1M12 16.9V19M5 12h2.1M16.9 12H19M7.05 7.05l1.5 1.5M15.45 15.45l1.5 1.5M16.95 7.05l-1.5 1.5M8.55 15.45l-1.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 19.5c1.2-3.4 4-5 7-5s5.8 1.6 7 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 18.5c.9-2.8 3.1-4.2 5.5-4.2s4.6 1.4 5.5 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.6c1.4.6 2.4 1.9 3 3.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
