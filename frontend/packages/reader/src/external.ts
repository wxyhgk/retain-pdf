// @retainpdf/reader — 自包含 external（不再代理 frontend/web）
// 保留与 frontend/web/src/pages/reader/external.ts 同样的导出面，但实现改为 adapters 注入 + 轻量 fallback
// 未注入时返回空/默认，保证 standalone 可 tsc/build，深功能需宿主 setReaderAdapters

import { getReaderAdapters, requireAdapter } from "./adapters.js";
import {
  resolveReaderDownloadName as defaultResolveReaderDownloadName,
  resolveReaderDownloadUrls as defaultResolveReaderDownloadUrls,
} from "./shared/state/downloads/resolve.js";
import {
  createReaderServerFavoritesPort as createSharedReaderServerFavoritesPort,
} from "./shared/state/server-favorites-port.js";
import type { CreateServerFavoritesPortOptions } from "./shared/types/types.js";
import {
  createReaderAskAnswerer as createSharedReaderAskAnswerer,
} from "./shared/ai/ask-answerer.js";

// —— config / mock / messaging ——
export const isMockMode = (...args: any[]): boolean => (getReaderAdapters()?.isMockMode as any)?.(...args) ?? false;
export const MOCK_DOCUMENT_SOURCE_PDF_URL = "";
export const READER_DIALOG_MESSAGES = Object.freeze({
  progress: "retainpdf-reader-progress",
});

// —— job / http / vendor ——
export const resolveResourceUrl = (url: string): string => (getReaderAdapters()?.resolveResourceUrl as any)?.(url) ?? url;
export const fetchProtected: typeof fetch = (...args: any[]) => (getReaderAdapters()?.fetchProtected as any)?.(...args) ?? (fetch as any)(...args);
export const resolvePdfjsVendorUrl = (relativePath = ""): string => (getReaderAdapters()?.resolvePdfjsVendorUrl as any)?.(relativePath) ?? "";

// —— js/reader 共享 ports ——
export const defaultReaderDataPort: any = new Proxy({} as any, { get: (_t, p) => (...a: any[]) => (getReaderAdapters()?.defaultReaderDataPort as any)?.[p as string]?.(...a) });
export const defaultReaderPageConfigPort: any = new Proxy({} as any, { get: (_t, p) => (...a: any[]) => (getReaderAdapters()?.defaultReaderPageConfigPort as any)?.[p as string]?.(...a) });
export const resolveReaderAnchor = (...a: any[]) => (getReaderAdapters()?.resolveReaderAnchor as any)?.(...a) ?? null;
export const resolveReaderDocumentId = (): string => (getReaderAdapters()?.resolveReaderDocumentId as any)?.() ?? "";
export const resolveReaderJobId = (...a: any[]): string => (getReaderAdapters()?.resolveReaderJobId as any)?.(...a) ?? "";
export const resolveReaderArtifactUrl = (...a: any[]) => (getReaderAdapters()?.resolveReaderArtifactUrl as any)?.(...a) ?? "";
export const resolveReaderSourcePdf = (...a: any[]) => (getReaderAdapters()?.resolveReaderSourcePdf as any)?.(...a) ?? null;
export const resolveReaderTranslatedPdfUrl = (...a: any[]) => (getReaderAdapters()?.resolveReaderTranslatedPdfUrl as any)?.(...a) ?? "";
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
export const createReaderAskAnswerer = (options: Record<string, unknown> = {}) => {
  const adapters = getReaderAdapters();
  return createSharedReaderAskAnswerer({
    apiPrefix: adapters?.apiPrefix || "/api/v1",
    ask: adapters?.askDocumentAi,
    documentByJobId: adapters?.fetchDocumentByJobId,
    ...options,
  });
};
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

// —— 服务端收藏 ——
export const API_PREFIX = "/api/v1";
export const fetchDocumentByJobId = (...args: [string, string]) =>
  requireAdapter("fetchDocumentByJobId")(...args);
export const fetchFavorites = (
  apiPrefix = API_PREFIX,
  options: { documentId?: string } = {},
) => requireAdapter("fetchFavorites")(
  getReaderAdapters()?.apiPrefix ?? apiPrefix,
  options,
);
export function createReaderServerFavoritesPort(options: CreateServerFavoritesPortOptions = {}) {
  const adapters = getReaderAdapters();
  return createSharedReaderServerFavoritesPort({
    apiPrefix: adapters?.apiPrefix ?? API_PREFIX,
    documentByJobId: (...args) => requireAdapter("fetchDocumentByJobId")(...args),
    submitFavorite: (...args) => requireAdapter("createFavorite")(...args),
    loadFavorites: (...args) => requireAdapter("fetchFavorites")(...args),
    removeFavorite: (...args) => requireAdapter("deleteFavorite")(...args),
    ...options,
  });
}
export { normalizeServerFavorite } from "./shared/state/server-favorites-port.js";
export type { ServerFavorite } from "./shared/types/types.js";

// —— 阅读器 AI 面板：模型 Key 门禁 ——
export {
  CREDENTIALS_CHANGED_EVENT,
  hasModelApiKey,
  MISSING_MODEL_API_KEY_MESSAGE,
} from "./shared/ai/config.js";
