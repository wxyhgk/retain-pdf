// @retainpdf/reader 对 RetainPDF Web 宿主能力的单一出口。
// Reader 实现通过公开 package exports 消费这里注入的 API、配置、下载、
// 收藏与 AI 能力；缺少宿主符号时只扩展本文件和 adapters/retainpdf.ts。

// —— config / mock / messaging ——
export { isMockMode } from "@/platform/config/runtime.js";
export { MOCK_DOCUMENT_SOURCE_PDF_URL } from "@/platform/mock/documents.js";
export { READER_DIALOG_MESSAGES } from "@/features/reader/domain.js";

// —— job / http / vendor ——
export { resolveResourceUrl } from "@retainpdf/domain/job";
export { fetchProtected } from "@/features/reader/domain.js";
export {
  resolvePdfjsVendorUrl,
  resolveMarkedVendorUrl,
} from "@/platform/runtime/vendor-url.js";

// —— Reader 宿主 ports：直连 shared/*，不经历史中转层 ——
export { defaultReaderDataPort } from "@/features/reader/domain.js";
export {
  defaultReaderPageConfigPort,
  resolveReaderAnchor,
  resolveReaderDocumentId,
  resolveReaderJobId,
} from "@/features/reader/domain.js";
export { resolveReaderArtifactUrl } from "@/features/reader/domain.js";
export {
  resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl,
} from "@/features/reader/domain.js";
export { READER_PROGRESS_COPY } from "@/features/reader/domain.js";

// —— 下载解析 / 受保护下载 ——
export {
  READER_DOWNLOAD_ACTIONS,
  disabledReason as readerDownloadDisabledReason,
  resolveReaderDownloadName,
  resolveReaderDownloadUrls,
  trimString as trimReaderDownloadString,
} from "@/features/reader/domain.js";
export { downloadProtectedResource } from "@/features/reader/domain.js";
export { failDownloadToast } from "@/platform/utils/download-feedback.js";

// —— markdown 面板 ——
export { resolveMarkdownAssetUrl } from "@retainpdf/domain/job";
export { parseMarkdownWithMath } from "@/features/reader/domain.js";

// —— AI 追问（react-pdf assistant）——
export { askLibraryAi } from "@/platform/api/index.js";
export { createReaderAskAnswerer } from "@/features/reader/domain.js";
export { createReaderMarkdownAnswerer } from "@/features/reader/domain.js";
export {
  hydrateProtectedImages,
  injectCitationMarkers,
  isAgenticCitation,
  neutralizeMarkdownAnchors,
  renderCitationFooter,
  revokeHydratedImageUrls,
} from "@/features/reader/domain.js";
export type { AiCitationLike } from "@/features/reader/domain.js";
export {
  armReaderAiClickShield,
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
  isReaderAiNavigationLocked,
  lockReaderAiNavigation,
  shouldIgnoreReaderAiNavEvent,
} from "@/features/reader/domain.js";
export {
  peekFinalAnswerHtmlCache,
  renderFinalAnswerHtml,
  renderStreamingPreviewHtml,
} from "@/features/reader/domain.js";
export { sanitizeAssistantAnswer } from "@/features/reader/domain.js";
export {
  clearThreadBranchSnapshot,
  loadThreadBranchSnapshot,
  saveThreadBranchSnapshot,
  threadBranchStorageKey,
  visiblePathFromSnapshot,
} from "@/features/reader/domain.js";
export type {
  ThreadBranchCitation,
  ThreadBranchItem,
  ThreadBranchMessage,
  ThreadBranchSnapshot,
} from "@/features/reader/domain.js";
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
} from "@/platform/api/index.js";
export type {
  ConversationDetail,
  ConversationRecord,
  MessageRecord,
} from "@/platform/api/index.js";
export {
  loadStoredConversationId,
  saveStoredConversationId,
  clearStoredConversationId,
} from "@/features/reader/domain.js";

// —— 服务端收藏面板 ——
export { API_PREFIX } from "@/platform/config/api-constants.js";
export { fetchDocumentByJobId } from "@/platform/api/index.js";
export {
  createFavorite,
  deleteFavorite,
  fetchFavorites,
} from "@/platform/api/index.js";
export {
  createReaderServerFavoritesPort,
  normalizeServerFavorite,
} from "@/features/reader/domain.js";
export type { ServerFavorite } from "@/features/reader/domain.js";

// —— 阅读器 AI 面板：模型 Key 门禁 ——
export { defaultCredentialsStatePort } from "@/features/credentials/domain.js";
export {
  CREDENTIALS_CHANGED_EVENT,
  hasModelApiKey,
  MISSING_MODEL_API_KEY_MESSAGE,
} from "@/features/reader/domain.js";
