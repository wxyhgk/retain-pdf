// backup —— 书库数据库备份：设置面板（由 HomeApp 以 slot 注入设置弹窗的「备份」分栏）。
//
// domain/ 说明文字（纯函数）
// ui/     设置面板

export { BackupPanel } from "./ui/BackupPanel.jsx";
export { backupTime, describeAuto, formatSize, kindLabel } from "./domain/describe.js";
