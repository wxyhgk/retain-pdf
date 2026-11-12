// settings —— 设置弹窗的外壳，加上本功能自己的「外观」一栏和更新页里的命令行工具。
//
// 这是本功能对外的唯一出口。外壳不知道有哪些分栏：各功能登记自己的分栏（ui/settings/settings-section.ts），
// 装配层 app/home/shell/settings-sections.tsx 列成表传进来，所以 settings 不横向依赖任何功能。
//
// ui/ 设置弹窗外壳、主题外观面板、弹窗 DOM id 契约

export { SettingsDialog } from "./ui/SettingsDialog.jsx";
export type { SettingsDialogProps } from "./ui/SettingsDialog.jsx";
export { ThemeAppearancePanel } from "./ui/ThemeAppearancePanel.jsx";
export {
  APP_SETTINGS_DIALOG_DATASETS,
  APP_SETTINGS_DIALOG_IDS,
} from "./ui/settings-dialog-ids.js";

// 设置弹窗里这一栏的登记 / 图标（20261112-功能登记表）。
export { appearanceSettingsSection } from "./ui/settings-section.jsx";
export { CommandLinePanel } from "./ui/CommandLinePanel.jsx";
