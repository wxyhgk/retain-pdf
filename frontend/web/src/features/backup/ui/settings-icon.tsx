// 设置弹窗左边导航上「backup」这一栏的图标（2026-11-12 从 settings/ui/settings-icons.tsx 搬来：图标跟着分栏归属的功能走）。
import type { SVGProps } from "react";

export function BackupSettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3.5" y="4" width="17" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 12.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
