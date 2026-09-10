import { getReaderAdapters } from "./adapters.js";
import { resolveReaderDownloadName as defaultResolveReaderDownloadName, resolveReaderDownloadUrls as defaultResolveReaderDownloadUrls } from "./shared/state/downloads/resolve.js";
import type { CreateServerFavoritesPortOptions } from "./shared/types/types.js";
export declare const isMockMode: (...args: any[]) => boolean;
export declare const MOCK_DOCUMENT_SOURCE_PDF_URL = "";
export declare const READER_DIALOG_MESSAGES: Readonly<{
    progress: "retainpdf-reader-progress";
}>;
export declare const resolveResourceUrl: (url: string) => string;
export declare const fetchProtected: typeof fetch;
export declare const resolvePdfjsVendorUrl: (relativePath?: string) => string;
export declare const defaultReaderDataPort: any;
export declare const defaultReaderPageConfigPort: any;
export declare const resolveReaderAnchor: (...a: any[]) => any;
export declare const resolveReaderDocumentId: () => string;
export declare const resolveReaderJobId: (...a: any[]) => string;
export declare const resolveReaderArtifactUrl: (...a: any[]) => any;
export declare const resolveReaderSourcePdf: (...a: any[]) => any;
export declare const resolveReaderTranslatedPdfUrl: (...a: any[]) => any;
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
export declare const createReaderAskAnswerer: (options?: Record<string, unknown>) => any;
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
export declare const fetchFavorites: (apiPrefix?: string, options?: {
    documentId?: string;
}) => Promise<{
    favorites?: any[];
}>;
export declare function createReaderServerFavoritesPort(options?: CreateServerFavoritesPortOptions): Readonly<{
    loadServerFavorites: () => Promise<import("./external.js").ServerFavorite[]>;
    recreateFavoriteNote: (annotation?: Partial<import("./external.js").ServerFavorite>, note?: string) => Promise<import("./external.js").ServerFavorite>;
    removeServerFavorite: (favoriteId: string) => Promise<boolean>;
    resolveDocumentId: () => Promise<string>;
    syncFavorite: (quote?: import("./runtime/state.js").SelectionQuote) => Promise<import("./runtime/state.js").FavoriteApiRecord>;
}>;
export { normalizeServerFavorite } from "./shared/state/server-favorites-port.js";
export type { ServerFavorite } from "./shared/types/types.js";
export { CREDENTIALS_CHANGED_EVENT, hasModelApiKey, MISSING_MODEL_API_KEY_MESSAGE, } from "./shared/ai/config.js";
//# sourceMappingURL=external.d.ts.map