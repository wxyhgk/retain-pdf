// 设置弹窗里「通知」这一栏的登记（格式见 ui/settings/settings-section.ts；装配层 app/home/shell/settings-sections.tsx 把它列进表）。
import type { SettingsSection } from "@/ui/settings/settings-section.js";
import { NotifySettingsIcon } from "./settings-icon.jsx";
import { NotifySettingsPanel } from "./NotifySettingsPanel.jsx";

export const notifySettingsSection: SettingsSection = {
  id: "notify",
  guide: "notify",
  label: "通知",
  Icon: NotifySettingsIcon,
  order: 80,
  description: "翻译、识别跑完（成功或失败）时提醒你，不用一直盯着页面。只对这台电脑、这个浏览器有效。",
  // 面板自己会取数：只在选中时才画。
  render: () => <NotifySettingsPanel />,
};
