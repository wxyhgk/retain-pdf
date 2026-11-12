// 设置弹窗左边导航上「sync」这一栏的图标（2026-11-12 从 settings/ui/settings-icons.tsx 搬来：图标跟着分栏归属的功能走）。
import type { SVGProps } from "react";

export function SyncSettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M19.5 9A7.5 7.5 0 0 0 6 6.6L4.5 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 4v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 15A7.5 7.5 0 0 0 18 17.4l1.5-1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 20v-4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
