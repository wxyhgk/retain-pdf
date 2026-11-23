// 设置弹窗里「备份」这一栏的登记（格式见 ui/settings/settings-section.ts；装配层 app/home/shell/settings-sections.tsx 把它列进表）。
import type { SettingsSection } from "@/ui/settings/settings-section.js";
import { BackupSettingsIcon } from "./settings-icon.jsx";
import { BackupPanel } from "./BackupPanel.jsx";

export const backupSettingsSection: SettingsSection = {
  id: "backup",
  guide: "backup",
  label: "备份",
  Icon: BackupSettingsIcon,
  order: 70,
  description: "书库数据库每天自动备份，出问题时可以恢复到之前的某一天。",
  // 面板自己会取数：只在选中时才画。
  render: () => <BackupPanel />,
};
