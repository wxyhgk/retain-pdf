// reader 的「非 React」出口。
//
// reader 页（src/pages/reader）与其它非 React 调用方从这里导入；
// React 侧从 index.ts 导入。index.ts 整体转出本文件，两处不会漂移。
//
// 说明：阅读器本体的实现在 @retainpdf/reader 包内，本功能只提供 RetainPDF 侧的
// 宿主接线——把数据、AI、收藏、下载、配置等能力注入给那个包。

export * from "./domain/host/ai.js";
export * from "./domain/host/config.js";
export * from "./domain/host/content.js";
export * from "./domain/host/data.js";
export * from "./domain/host/state.js";

// host/data.ts、host/config.ts 与 runtime/content 各有一个 resolveReaderJobId，
// 来自 reader 包的不同 runtime：config 版是带 mock 绑定的宿主包装版（生产在用，
// 见 pages/reader/external.ts），data 版是 runtime/data 的原样转出。
// 显式指定二者，避免 barrel 静默丢掉其中一个。
export { resolveReaderJobId } from "./domain/host/config.js";
export { resolveReaderJobId as resolveReaderResourceJobId } from "./domain/host/data.js";
export { READER_DIALOG_MESSAGES } from "./domain/dialog/contract.js";
export {
  buildReaderDocumentPageUrl,
  buildReaderPageUrl,
  buildReaderRouteUrl,
  requestedReaderJobIdFromLocation,
} from "./domain/dialog/routing.js";
export {
  createReaderDialogConfigPort,
  defaultReaderDialogConfigPort,
} from "./domain/dialog/config-port.js";
export { createReaderDialogRuntimePort } from "./domain/dialog/runtime-port.js";
export * from "./domain/dialog/downloads.js";
export * from "./domain/navigate-to-reader.js";
