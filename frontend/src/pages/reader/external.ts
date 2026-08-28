// Điểm xuất từ "engine mới / tầng shared" của reader sang src/js/*.
//
// Chỉ dùng cho đường pages/reader không phải legacy:
//   hooks/、pdf/、annotations/、components/react-pdf/、ReaderAppReactPdf
// Thiếu symbol thì chỉ sửa file này.
//
// legacy/** và ?engine=legacy tiếp tục import trực tiếp engine imperative js/reader
// (pdf-controller / selection-favorites / regions...). Không nhét chúng vào đây.

// -- config / mock / messaging --
export { isMockMode } from "../../js/config/runtime.js";
export { MOCK_DOCUMENT_SOURCE_PDF_URL } from "../../js/mock/documents.js";
export { READER_DIALOG_MESSAGES } from "../../js/features/reader-dialog/contract.js";

// -- job / http / vendor --
export { resolveResourceUrl } from "../../js/job/artifacts.js";
export { fetchProtected } from "../../js/api/http.js";
export {
  resolvePdfjsVendorUrl,
  resolveMarkedVendorUrl,
} from "../../js/runtime/vendor-url.js";

// -- shared ports js/reader (subset engine mới được phép phụ thuộc) --
export { defaultReaderDataPort } from "../../js/reader/data-port.js";
export {
  defaultReaderPageConfigPort,
  resolveReaderAnchor,
  resolveReaderDocumentId,
  resolveReaderJobId,
} from "../../js/reader/config-port.js";
export { resolveReaderArtifactUrl } from "../../js/reader/pdf-document.js";
export {
  resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl,
} from "../../js/reader/resource-resolver.js";
export { READER_PROGRESS_COPY } from "../../js/reader/page-state.js";

// -- download (dùng chung resolve / protected download với legacy) --
export {
  READER_DOWNLOAD_ACTIONS,
  disabledReason as readerDownloadDisabledReason,
  resolveReaderDownloadName,
  resolveReaderDownloadUrls,
  trimString as trimReaderDownloadString,
} from "../../js/reader/downloads/resolve.js";
export { downloadProtectedResource } from "../../js/features/reader-dialog/downloads.js";
export { failDownloadToast } from "../../js/utils/download-feedback.js";

// -- markdown panel --
export { resolveMarkdownAssetUrl } from "../../js/job/artifacts.js";
export { parseMarkdownWithMath } from "../../js/reader/markdown-math.js";

// -- AI follow-up (react-pdf assistant) --
export { createReaderAskAnswerer } from "../../js/reader/ai/ask-answerer.js";
export { createReaderMarkdownAnswerer } from "../../js/reader/ai/markdown-answerer.js";
export {
  hydrateProtectedImages,
  injectCitationMarkers,
  isAgenticCitation,
  neutralizeMarkdownAnchors,
  renderCitationFooter,
  revokeHydratedImageUrls,
} from "../../js/reader/ai/answer-enhance.js";
export type { AiCitationLike } from "../../js/reader/ai/answer-enhance.js";
export {
  armReaderAiClickShield,
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
  isReaderAiNavigationLocked,
  lockReaderAiNavigation,
  shouldIgnoreReaderAiNavEvent,
} from "../../js/reader/ai/ui-interaction-lock.js";
export {
  peekFinalAnswerHtmlCache,
  renderFinalAnswerHtml,
  renderStreamingPreviewHtml,
} from "../../js/reader/ai/render-answer-html.js";
export { sanitizeAssistantAnswer } from "../../js/reader/ai/sanitize-answer.js";
export {
  clearThreadBranchSnapshot,
  loadThreadBranchSnapshot,
  saveThreadBranchSnapshot,
  threadBranchStorageKey,
  visiblePathFromSnapshot,
} from "../../js/reader/ai/thread-branch-store.js";
export type {
  ThreadBranchCitation,
  ThreadBranchItem,
  ThreadBranchMessage,
  ThreadBranchSnapshot,
} from "../../js/reader/ai/thread-branch-store.js";
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
} from "../../js/api/conversations.js";
export type {
  ConversationDetail,
  ConversationRecord,
  MessageRecord,
} from "../../js/api/conversations.js";
export {
  loadStoredConversationId,
  saveStoredConversationId,
  clearStoredConversationId,
} from "../../js/reader/ai/conversation-store.js";

// -- server favorites panel --
export { API_PREFIX } from "../../js/config/api-constants.js";
export { fetchFavorites } from "../../js/api/favorites.js";
export {
  createReaderServerFavoritesPort,
  normalizeServerFavorite,
} from "../../js/reader/server-favorites-port.js";
export type { ServerFavorite } from "../../js/reader/types.js";
