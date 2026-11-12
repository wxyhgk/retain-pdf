// 设置弹窗里「同步」这一栏的登记（格式见 ui/settings/settings-section.ts；装配层 app/home/shell/settings-sections.tsx 把它列进表）。
import type { SettingsSection } from "@/ui/settings/settings-section.js";
import { SyncSettingsIcon } from "./settings-icon.jsx";
import { SyncSettingsPanel } from "./SyncSettingsPanel.jsx";

export const syncSettingsSection: SettingsSection = {
  id: "sync",
  label: "同步",
  Icon: SyncSettingsIcon,
  order: 60,
  description: "通过一个网盘文件夹，在几台电脑之间同步书库、译文和阅读进度。",
  // 面板自己会取数：只在选中时才画。
  render: () => <SyncSettingsPanel />,
};
