// 设置弹窗里「总用量」这一栏的登记（格式见 ui/settings/settings-section.ts；装配层 app/home/shell/settings-sections.tsx 把它列进表）。
import type { SettingsSection } from "@/ui/settings/settings-section.js";
import { UsageSettingsIcon } from "./settings-icon.jsx";
import { UsageSettingsPanel } from "./UsageSettingsPanel.jsx";

export const usageSettingsSection: SettingsSection = {
  id: "usage",
  label: "总用量",
  Icon: UsageSettingsIcon,
  order: 50,
  description: "全部书花掉的模型 token，按月、按模型、按环节。",
  // 面板自己会取数：只在选中时才画。
  render: () => <UsageSettingsPanel />,
};
