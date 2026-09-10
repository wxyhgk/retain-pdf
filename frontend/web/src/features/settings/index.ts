// settings —— 设置中心弹窗：API 凭据 / 词表 / 主题外观 / 应用更新四个 tab。
//
// 这是本功能对外的唯一出口。本功能只提供外壳与主题面板；凭据工作台与更新横幅
// 由页面以 slot 形式注入，故 settings 不横向依赖 credentials / app-update 两个功能。
//
// ui/ 设置弹窗外壳、主题外观面板、弹窗 DOM id 契约

export { SettingsHubDialog } from "./ui/SettingsHubDialog.jsx";
export type { SettingsHubDialogProps } from "./ui/SettingsHubDialog.jsx";
export { ThemeAppearancePanel } from "./ui/ThemeAppearancePanel.jsx";
export {
  APP_SETTINGS_DIALOG_DATASETS,
  APP_SETTINGS_DIALOG_IDS,
} from "./ui/settings-dialog-ids.js";
