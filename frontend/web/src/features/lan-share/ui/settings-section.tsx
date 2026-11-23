// 设置弹窗里「局域网共享」这一栏的登记（格式见 ui/settings/settings-section.ts）。只在桌面版单机模式列进表
// （app/home/shell/settings-sections.tsx）：网页版、多用户本身就是服务器，没有这一栏。
import type { SettingsSection } from "@/ui/settings/settings-section.js";
import { LanShareSettingsIcon } from "./settings-icon.jsx";
import { LanSharePanel } from "./LanSharePanel.jsx";

export const lanShareSettingsSection: SettingsSection = {
  id: "lan-share",
  guide: "lan-share",
  label: "局域网共享",
  Icon: LanShareSettingsIcon,
  order: 65,
  description: "让同一个 Wi‑Fi 里的手机、平板、别的电脑用浏览器打开这台电脑上的 RetainPDF。",
  // 面板自己会取状态：只在选中时才画。
  render: () => <LanSharePanel />,
};
