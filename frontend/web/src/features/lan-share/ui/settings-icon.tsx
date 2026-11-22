// 设置弹窗左边导航上「局域网共享」这一栏的图标：一台电脑旁边一部手机。
import type { SVGProps } from "react";

export function LanShareSettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="2.5" y="4.5" width="13" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 18h6M9 14v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="16.5" y="9" width="5" height="10.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M18.6 17h.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
