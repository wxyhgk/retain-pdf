// usage —— 模型 token 用量：书籍详情「进度」页的「用量」、设置里的「总用量」。
//
// domain/ 把 UsageSummaryView 整理成要显示的数字、分组与说明（纯函数）
// ui/     共用展示、书籍卡、设置面板

export { UsageCompact } from "./ui/UsageCompact.jsx";
export { useDocumentUsage, useUsage } from "./ui/use-usage.js";
export type { UsageState } from "./ui/use-usage.js";
export { UsageSettingsPanel } from "./ui/UsageSettingsPanel.jsx";
export { usageViewModel } from "./domain/usage-view-model.js";
export type { UsageViewModel } from "./domain/usage-view-model.js";
