// @retainpdf/reader — 包内运行时访问层（runtime access layer）。
//
// 与 frontend/web/src/app/reader/external.ts 同名但方向相反、职责不同：
//   - 本文件（包内）：包内代码「读取」宿主注入能力的访问层，实现是
//     adapters 注入 + 轻量 fallback，未注入时返回空/默认，保证 standalone
//     可 tsc/build；深功能需宿主先 setReaderAdapters。
//   - web app/reader/external.ts（宿主）：RetainPDF Web「提供」给包的能力出口。
// 二者不是互相转发关系，改动任一侧前先确认方向，避免误把宿主导出搬进包内。
//
// 职责边界：adapters.ts 是宿主能力的「注入注册表」，本文件是包内读取这些
// 能力的「运行时访问层」。历史上独立的 config-port.ts 已删除，其宿主配置
// 能力统一由 adapters + runtime/config 承载，不要再新增平行入口。
// 未注入的 port 尽量给出空/默认实现；缺失关键能力时才 requireAdapter 抛错。
// data/pageConfig port 采用显式方法转发（见下方），方法名与形状都由包内 runtime
// 工厂签名派生，宿主漏接或拼错会在 tsc/运行时立刻暴露。极少数 `as any` 仅用于
// port 签名比宿主实现窄（0 参 vs 可选入参），属有意为之且已就近注释。

import { getReaderAdapters, requireAdapter } from "./adapters.js";
import type { createReaderDataPort } from "./runtime/data.js";
import type { createReaderPageConfigPort } from "./runtime/config.js";
import type { ReaderPdfPort } from "./contracts/pdf.js";
import type { ReaderSessionDataPort } from "./contracts/session.js";
import {
  resolveReaderDownloadName as defaultResolveReaderDownloadName,
  resolveReaderDownloadUrls as defaultResolveReaderDownloadUrls,
} from "./shared/state/downloads/resolve.js";
import {
} from "./shared/ai/ask-answerer.js";

// —— config / mock / messaging ——
export const isMockMode = (...args: any[]): boolean => (getReaderAdapters()?.isMockMode as any)?.(...args) ?? false;
export const MOCK_DOCUMENT_SOURCE_PDF_URL = "";
export const READER_DIALOG_MESSAGES = Object.freeze({
  progress: "retainpdf-reader-progress",
});

// —— job / http / vendor ——
export const resolveResourceUrl = (url: string): string =>
  getReaderAdapters()?.resolveResourceUrl?.(url) ?? url;
export const fetchProtected: typeof fetch = (...args: any[]) => {
  const impl = getReaderAdapters()?.fetchProtected ?? fetch;
  return (impl as (...a: any[]) => Promise<Response>)(...args);
};
export const resolvePdfjsVendorUrl = (relativePath = ""): string =>
  (getReaderAdapters()?.resolvePdfjsVendorUrl as any)?.(relativePath) ?? "";

// —— js/reader 共享 ports ——
// 显式方法转发：方法名写死，宿主 port 缺失或拼错方法名都会在此抛错，
// 而不是旧 Proxy 静默返回 undefined。形状由 adapter 契约（runtime 工厂
// 派生的具体类型）约束，方法增删会在 tsc 阶段暴露。
type ReaderDataPort = ReturnType<typeof createReaderDataPort>;
type ReaderPageConfigPort = ReturnType<typeof createReaderPageConfigPort>;
const readDataPort = (): ReaderDataPort => requireAdapter("defaultReaderDataPort");
const readPageConfigPort = (): ReaderPageConfigPort =>
  requireAdapter("defaultReaderPageConfigPort");
export const defaultReaderDataPort: ReaderDataPort = {
  get apiPrefix(): string { return readDataPort().apiPrefix; },
  fetchProtected: (...args: Parameters<typeof fetch>) => readDataPort().fetchProtected(...args),
  loadMarkdownPayload: (jobId) => readDataPort().loadMarkdownPayload(jobId),
  loadMarkdownSource: (jobId) => readDataPort().loadMarkdownSource(jobId),
  loadMarkdownRange: (rawUrl, start, endInclusive, etag, signal) =>
    readDataPort().loadMarkdownRange(rawUrl, start, endInclusive, etag, signal),
  loadJobPayload: (jobId) => readDataPort().loadJobPayload(jobId),
  loadReaderPayload: (jobId, options) => readDataPort().loadReaderPayload(jobId, options),
  loadReaderOptionalArtifacts: (jobId) => readDataPort().loadReaderOptionalArtifacts(jobId),
  get liveTranslation() { return readDataPort().liveTranslation; },
};
export const defaultReaderPageConfigPort: ReaderPageConfigPort = {
  messageTargetOrigin: () => readPageConfigPort().messageTargetOrigin(),
  readerJobId: () => readPageConfigPort().readerJobId(),
};

export const readerLiveTranslation = () => getReaderAdapters()?.liveTranslation ?? null;
/** 「摘到笔记」：放在笔记（Studio）里、握过手时宿主才给；没有就是 null。 */
export const readerNotesQuote = () => getReaderAdapters()?.notesQuote ?? null;
/** 「笔记」按钮：同上，宿主给了才有。 */
export const readerNotesPanel = () => getReaderAdapters()?.notesPanel ?? null;
/** 告诉宿主眼下读到哪：同上，宿主给了才有。 */
export const readerReadingPosition = () => getReaderAdapters()?.readingPosition ?? null;
export const readerPdfPort = (): ReaderPdfPort => {
  const adapters = getReaderAdapters();
  return adapters?.pdf ?? {
    fetchProtected: adapters?.fetchProtected ?? adapters?.defaultReaderDataPort?.fetchProtected ?? fetch,
    resolvePdfjsVendorUrl: (relativePath = "") => adapters?.resolvePdfjsVendorUrl?.(relativePath) ?? "",
  };
};
export const readerSessionDataPort = (): ReaderSessionDataPort => {
  const adapters = getReaderAdapters();
  if (adapters?.sessionData) return adapters.sessionData;
  const data = adapters?.defaultReaderDataPort;
  if (!data) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: data.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: data.loadReaderOptionalArtifacts,
    loadJobPayload: data.loadJobPayload,
    fetchDocumentByJobId: (...args) => requireAdapter("fetchDocumentByJobId")(...args),
    fetchProtected: data.fetchProtected,
    resolveResourceUrl: adapters.resolveResourceUrl ?? ((url) => url),
    resolveReaderSourcePdf: (manifestPayload) => adapters.resolveReaderSourcePdf?.(manifestPayload) ?? null,
    resolveReaderTranslatedPdfUrl: (jobPayload, manifestPayload) => adapters.resolveReaderTranslatedPdfUrl?.(jobPayload, manifestPayload) ?? "",
    resolveReaderArtifactUrl: (item) => adapters.resolveReaderArtifactUrl?.(item) ?? "",
  };
};

export const resolveReaderAnchor = (...a: any[]) => getReaderAdapters()?.resolveReaderAnchor?.(...a) ?? null;
export const resolveReaderDocumentId = (): string => getReaderAdapters()?.resolveReaderDocumentId?.() ?? "";
// resolveReaderJobId / resolvePdfjsVendorUrl 的 port 签名比宿主实现窄
//（0 参 vs 可选入参），保留最小局部 cast 以原样转发参数。
export const resolveReaderJobId = (...a: any[]): string => (getReaderAdapters()?.resolveReaderJobId as any)?.(...a) ?? "";
export const resolveReaderArtifactUrl = (...a: any[]) => getReaderAdapters()?.resolveReaderArtifactUrl?.(...a) ?? "";
export const resolveReaderSourcePdf = (...a: any[]) => getReaderAdapters()?.resolveReaderSourcePdf?.(...a) ?? null;
export const resolveReaderTranslatedPdfUrl = (...a: any[]) => getReaderAdapters()?.resolveReaderTranslatedPdfUrl?.(...a) ?? "";
export { READER_PROGRESS_COPY } from "./shared/state/page-state.js";

// —— 下载 ——
export {
  READER_DOWNLOAD_ACTIONS,
  disabledReason as readerDownloadDisabledReason,
  trimString as trimReaderDownloadString,
} from "./shared/state/downloads/resolve.js";
export const resolveReaderDownloadName: typeof defaultResolveReaderDownloadName = (...args) =>
  getReaderAdapters()?.resolveReaderDownloadName?.(...args)
  ?? defaultResolveReaderDownloadName(...args);
export const resolveReaderDownloadUrls: typeof defaultResolveReaderDownloadUrls = (...args) =>
  getReaderAdapters()?.resolveReaderDownloadUrls?.(...args)
  ?? defaultResolveReaderDownloadUrls(...args);
export const downloadProtectedResource = (...args: Parameters<ReaderAdaptersDownloadResource>) =>
  requireAdapter("downloadProtectedResource")(...args);
export const failDownloadToast = (...args: Parameters<ReaderAdaptersFailToast>) =>
  requireAdapter("failDownloadToast")(...args);
type ReaderAdaptersDownloadResource = NonNullable<ReturnType<typeof getReaderAdapters>>["downloadProtectedResource"];
type ReaderAdaptersFailToast = NonNullable<ReturnType<typeof getReaderAdapters>>["failDownloadToast"];

// —— markdown ——
export const resolveMarkdownAssetUrl = (
  imagesBaseUrl: unknown,
  relativePath: unknown,
): string => requireAdapter("resolveMarkdownAssetUrl")(imagesBaseUrl, relativePath);
export { parseMarkdownWithMath } from "./shared/content/markdown-math.js";

// —— AI ——
// Factory 在 package 边界内消费宿主 adapter，调用方只需传 jobId。
// 旧实现直接 re-export shared factory，导致默认 ask/documentByJobId 空实现。
export { createReaderMarkdownAnswerer } from "./shared/ai/markdown-answerer.js";
export {
  hydrateProtectedImages,
  injectCitationMarkers,
  isAgenticCitation,
  mountAnswerHtml,
  normalizeAiCitations,
  neutralizeMarkdownAnchors,
  renderCitationFooter,
  revokeHydratedImageUrls,
} from "./shared/ai/answer-enhance.js";
export type { AiCitationLike } from "./shared/ai/answer-enhance.js";
export {
  armReaderAiClickShield,
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
  isReaderAiNavigationLocked,
  lockReaderAiNavigation,
  shouldIgnoreReaderAiNavEvent,
} from "./shared/ai/ui-interaction-lock.js";
export {
  peekFinalAnswerHtmlCache,
  renderFinalAnswerHtml,
  renderStreamingPreviewHtml,
} from "./shared/ai/render-answer-html.js";
export { sanitizeAssistantAnswer } from "./shared/ai/sanitize-answer.js";
export {
  clearThreadBranchSnapshot,
  loadThreadBranchSnapshot,
  saveThreadBranchSnapshot,
  threadBranchStorageKey,
  visiblePathFromSnapshot,
} from "./shared/ai/thread-branch-store.js";
export type {
  ThreadBranchCitation,
  ThreadBranchItem,
  ThreadBranchMessage,
  ThreadBranchSnapshot,
} from "./shared/ai/thread-branch-store.js";
export {
  appendConversationMessage,
  baseConversationTitle,
  createConversation,
  deleteConversation,
  forkConversationFromPath,
  getConversation,
  listConversations,
  messagesToBranchItems,
  nextForkConversationTitle,
  patchConversation,
} from "@retainpdf/api/conversations";
export type {
  ConversationDetail,
  ConversationRecord,
  MessageRecord,
} from "@retainpdf/api/conversations";
export {
  clearStoredConversationId,
  loadStoredConversationId,
  saveStoredConversationId,
} from "./shared/ai/conversation-store.js";

// —— 文档身份（按 jobId 反查）——
export const API_PREFIX = "/api/v1";
export const fetchDocumentByJobId = (...args: [string, string]) =>
  requireAdapter("fetchDocumentByJobId")(...args);

// —— 阅读器 AI 面板：模型 Key 门禁 ——
export {
  CREDENTIALS_CHANGED_EVENT,
  hasModelApiKey,
  MISSING_MODEL_API_KEY_MESSAGE,
} from "./shared/ai/config.js";
