// 设置弹窗左边导航上「usage」这一栏的图标（2026-11-12 从 settings/ui/settings-icons.tsx 搬来：图标跟着分栏归属的功能走）。
import type { SVGProps } from "react";

export function UsageSettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4.5 19.5h15M7.5 16v-4M12 16V8M16.5 16v-6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
