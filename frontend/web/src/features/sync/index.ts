// sync —— 多设备同步：设置面板（由 HomeApp 以 slot 注入设置弹窗的「同步」分栏）。
//
// domain/ 状态描述（纯函数）
// ui/     设置面板

export { SyncSettingsPanel } from "./ui/SyncSettingsPanel.jsx";
export { describePending, describeSyncStatus, relativeTime } from "./domain/describe.js";
