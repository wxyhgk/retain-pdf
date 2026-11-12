// notify —— 任务跑完时告诉用户：主页上没有界面的盯梢组件，加上设置里的「通知」分栏。
//
// domain/ 盯任务列表、决定怎么提醒（纯逻辑）
// ui/     挂在主页上的 JobFinishNotifier、设置面板

export { JobFinishNotifier } from "./ui/JobFinishNotifier.jsx";
export { NotifySettingsPanel } from "./ui/NotifySettingsPanel.jsx";
export type { FinishedJob } from "./domain/job-finish-watcher.js";

// 设置弹窗里这一栏的登记 / 图标（20261112-功能登记表）。
export { notifySettingsSection } from "./ui/settings-section.jsx";
