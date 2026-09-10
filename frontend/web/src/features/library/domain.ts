// library 的「纯净」出口：只含类型、卡片语义与徽标、翻译/OCR 复用判定。
//
// 为什么单列：index.ts 为页面装配层提供完整能力，会连带加载 recent-jobs 运行时
// （31 个模块，其中 state.ts / bindings.ts 持有模块级状态）。其它功能只需要这些
// 纯函数与类型，走 index.ts 会把整套运行时在装配之前急切初始化，改变状态归属
// ——实测会让书架渲染成 mock 内置馆藏卡而非调用方写入的条目。
//
// 规则：跨功能引用 library 一律走本文件；只有页面装配层用 index.ts。

export * from "./domain/types.js";
export * from "./domain/card/library-card-badge.js";
export * from "./domain/card/library-card-semantics.js";
export * from "./domain/translation-ocr-reuse.js";
// 卡片状态判定与文案：book-detail 等功能需要，且与 recent-jobs 运行时无关。
export { isLibraryOnlyItem } from "./domain/documents/document-card-item.js";
export {
  isRecentJobActive,
  recentJobProgressPercent,
  recentJobRawImageUrls,
  recentJobStageLabel,
  recentJobStatusLabel,
  recentJobTitle,
  stageKeyForRecentJobLabel,
} from "./domain/card/recent-job-card-presenter.js";
