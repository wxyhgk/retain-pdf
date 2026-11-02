import { getReaderAdapters } from "./adapters.js";
import type { createReaderDataPort } from "./runtime/data.js";
import type { createReaderPageConfigPort } from "./runtime/config.js";
import type { ReaderPdfPort } from "./contracts/pdf.js";
import type { ReaderSessionDataPort } from "./contracts/session.js";
import { resolveReaderDownloadName as defaultResolveReaderDownloadName, resolveReaderDownloadUrls as defaultResolveReaderDownloadUrls } from "./shared/state/downloads/resolve.js";
export declare const isMockMode: (...args: any[]) => boolean;
export declare const MOCK_DOCUMENT_SOURCE_PDF_URL = "";
export declare const READER_DIALOG_MESSAGES: Readonly<{
    progress: "retainpdf-reader-progress";
}>;
export declare const resolveResourceUrl: (url: string) => string;
export declare const fetchProtected: typeof fetch;
export declare const resolvePdfjsVendorUrl: (relativePath?: string) => string;
type ReaderDataPort = ReturnType<typeof createReaderDataPort>;
type ReaderPageConfigPort = ReturnType<typeof createReaderPageConfigPort>;
export declare const defaultReaderDataPort: ReaderDataPort;
export declare const defaultReaderPageConfigPort: ReaderPageConfigPort;
export declare const readerLiveTranslation: () => import("./contracts/live-translation.js").ReaderLiveTranslationPort;
/** 「摘到笔记」：放在笔记（Studio）里、握过手时宿主才给；没有就是 null。 */
export declare const readerNotesQuote: () => {
    available: () => boolean;
    send: (quote: import("./adapters.js").ReaderNotesQuote) => boolean;
};
/** 「笔记」按钮：同上，宿主给了才有。 */
export declare const readerNotesPanel: () => {
    getState: () => import("./adapters.js").ReaderNotesPanelState;
    subscribe: (listener: () => void) => () => void;
    toggle: () => void;
};
/** 告诉宿主眼下读到哪：同上，宿主给了才有。 */
export declare const readerReadingPosition: () => {
    report: (pageIdx: number | null, pageCount: number | null) => void;
};
export declare const readerPdfPort: () => ReaderPdfPort;
export declare const readerSessionDataPort: () => ReaderSessionDataPort;
export declare const resolveReaderAnchor: (...a: any[]) => any;
export declare const resolveReaderDocumentId: () => string;
export declare const resolveReaderJobId: (...a: any[]) => string;
export declare const resolveReaderArtifactUrl: (...a: any[]) => string;
export declare const resolveReaderSourcePdf: (...a: any[]) => any;
export declare const resolveReaderTranslatedPdfUrl: (...a: any[]) => string;
export { READER_PROGRESS_COPY } from "./shared/state/page-state.js";
export { READER_DOWNLOAD_ACTIONS, disabledReason as readerDownloadDisabledReason, trimString as trimReaderDownloadString, } from "./shared/state/downloads/resolve.js";
export declare const resolveReaderDownloadName: typeof defaultResolveReaderDownloadName;
export declare const resolveReaderDownloadUrls: typeof defaultResolveReaderDownloadUrls;
export declare const downloadProtectedResource: (...args: Parameters<ReaderAdaptersDownloadResource>) => Promise<unknown>;
export declare const failDownloadToast: (...args: Parameters<ReaderAdaptersFailToast>) => void;
type ReaderAdaptersDownloadResource = NonNullable<ReturnType<typeof getReaderAdapters>>["downloadProtectedResource"];
type ReaderAdaptersFailToast = NonNullable<ReturnType<typeof getReaderAdapters>>["failDownloadToast"];
export declare const resolveMarkdownAssetUrl: (imagesBaseUrl: unknown, relativePath: unknown) => string;
export { parseMarkdownWithMath } from "./shared/content/markdown-math.js";
export { createReaderMarkdownAnswerer } from "./shared/ai/markdown-answerer.js";
export { hydrateProtectedImages, injectCitationMarkers, isAgenticCitation, mountAnswerHtml, normalizeAiCitations, neutralizeMarkdownAnchors, renderCitationFooter, revokeHydratedImageUrls, } from "./shared/ai/answer-enhance.js";
export type { AiCitationLike } from "./shared/ai/answer-enhance.js";
export { armReaderAiClickShield, clearReaderAiNavigationLock, installReaderWindowOpenGuard, isReaderAiNavigationLocked, lockReaderAiNavigation, shouldIgnoreReaderAiNavEvent, } from "./shared/ai/ui-interaction-lock.js";
export { peekFinalAnswerHtmlCache, renderFinalAnswerHtml, renderStreamingPreviewHtml, } from "./shared/ai/render-answer-html.js";
export { sanitizeAssistantAnswer } from "./shared/ai/sanitize-answer.js";
export { clearThreadBranchSnapshot, loadThreadBranchSnapshot, saveThreadBranchSnapshot, threadBranchStorageKey, visiblePathFromSnapshot, } from "./shared/ai/thread-branch-store.js";
export type { ThreadBranchCitation, ThreadBranchItem, ThreadBranchMessage, ThreadBranchSnapshot, } from "./shared/ai/thread-branch-store.js";
export { appendConversationMessage, baseConversationTitle, createConversation, deleteConversation, forkConversationFromPath, getConversation, listConversations, messagesToBranchItems, nextForkConversationTitle, patchConversation, } from "@retainpdf/api/conversations";
export type { ConversationDetail, ConversationRecord, MessageRecord, } from "@retainpdf/api/conversations";
export { clearStoredConversationId, loadStoredConversationId, saveStoredConversationId, } from "./shared/ai/conversation-store.js";
export declare const API_PREFIX = "/api/v1";
export declare const fetchDocumentByJobId: (...args: [string, string]) => Promise<{
    document_id?: string;
    active_job_id?: string | null;
    active_version_id?: string | null;
}>;
export { CREDENTIALS_CHANGED_EVENT, hasModelApiKey, MISSING_MODEL_API_KEY_MESSAGE, } from "./shared/ai/config.js";
//# sourceMappingURL=external.d.ts.map