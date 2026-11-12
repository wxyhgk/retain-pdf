// 设置弹窗左边导航上「admin」这一栏的图标（2026-11-12 从 settings/ui/settings-icons.tsx 搬来：图标跟着分栏归属的功能走）。
import type { SVGProps } from "react";

export function AdminSettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 18.5c.9-2.8 3.1-4.2 5.5-4.2s4.6 1.4 5.5 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.6c1.4.6 2.4 1.9 3 3.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
