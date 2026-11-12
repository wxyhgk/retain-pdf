// 设置弹窗左边导航上「credentials」这一栏的图标（2026-11-12 从 settings/ui/settings-icons.tsx 搬来：图标跟着分栏归属的功能走）。
import type { SVGProps } from "react";

export function CredentialsSettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M14.5 9.5a4 4 0 1 1-1.2 2.86L5 20.65 3.35 19 11.6 10.7A4 4 0 0 1 14.5 9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
