// reader 的「非 React」出口。
//
// reader 页（src/app/reader）与其它非 React 调用方从这里导入；
// React 侧从 index.ts 导入。index.ts 逐条转出本文件，两处不会漂移。
//
// 说明：阅读器本体的实现在 @retainpdf/reader 包内，本功能只提供 RetainPDF 侧的
// 宿主接线——把数据、下载、配置等能力注入给那个包。
//
// 出口逐条显式列举，不用 export * 整体转出 host/* ——那会把包 runtime 的全部
// 导出与模块级适配器注册一并泄漏/提前触发，且无法审计真实对外面。

export {
  createReaderPageConfigPort,
  defaultReaderPageConfigPort,
  resolveReaderAnchor,
  resolveReaderDocumentId,
} from "./domain/host/config.js";

export {
  extractMarkdownMath,
  materializeMarkdownMathFallbackHtml,
  materializeMarkdownMathHtml,
  mathFailureStats,
  normalizeBlockKey,
  parseMarkdownWithMath,
  resetMarkdownMathEngineLoader,
  revealProtectedTokens,
  setMarkdownMathEngineLoader,
  wrapMathSvgHtml,
} from "./domain/host/content.js";

export {
  buildPdfDocumentOptions,
  defaultReaderDataPort,
  fetchProtected,
  liveTranslationPort,
  pdfPort,
  sessionDataPort,
  resolveReaderArtifactUrl,
  resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl,
} from "./domain/host/data.js";

export {
  READER_DOWNLOAD_ACTIONS,
  READER_PROGRESS_COPY,
  computeReaderProgressSnapshot,
  createReaderPageState,
  disabledReason,
  resetReaderProgressState,
  resolveReaderDownloadName,
  resolveReaderDownloadUrls,
  trimString,
} from "./domain/host/state.js";
export type { ServerFavorite } from "./domain/host/state.js";

// host/data.ts、host/config.ts 各有一个 resolveReaderJobId，
// 来自 reader 包的不同 runtime：config 版是带 mock 绑定的宿主包装版（生产在用，
// 见 app/reader/external.ts），data 版是 runtime/data 的原样转出。
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
export { downloadProtectedResource } from "./domain/dialog/downloads.js";
export { navigateToReader, setReaderNavigateForTests } from "./domain/navigate-to-reader.js";
