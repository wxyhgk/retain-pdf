export { hasMarkdownContent, loadMarkdownPayloadWithFallback, normalizeMarkdownPayload, } from "./shared/data/markdown-payload.js";
export type ReaderMode = "source" | "translated" | "compare";
export type ReaderDocumentSource = {
    sourceUrl: string;
    translatedUrl?: string | null;
    sourceFile?: unknown | null;
    translatedFile?: unknown | null;
    title?: string;
};
export type ReaderSessionAdapters = {
    resolveSession?: () => {
        jobId?: string;
        documentId?: string;
        sourceOnly?: boolean;
        mode?: ReaderMode;
    };
    resolveDocument?: () => Promise<ReaderDocumentSource> | ReaderDocumentSource;
    fetchPdf?: (url: string, init?: RequestInit) => Promise<Response>;
    favoritesPort?: unknown;
    aiAnswerer?: unknown;
    markdownLoader?: (jobId: string) => Promise<string>;
    isMockMode?: () => boolean;
    resolveResourceUrl?: (url: string) => string;
    fetchProtected?: typeof fetch;
    resolvePdfjsVendorUrl?: () => string;
    defaultReaderDataPort?: unknown;
    defaultReaderPageConfigPort?: unknown;
    resolveReaderAnchor?: (...args: any[]) => any;
    resolveReaderDocumentId?: () => string;
    resolveReaderJobId?: () => string;
    resolveReaderArtifactUrl?: (...args: any[]) => string;
    resolveReaderSourcePdf?: (...args: any[]) => any;
    resolveReaderTranslatedPdfUrl?: (...args: any[]) => string;
};
export type ReaderMarkdownAdapters = {
    resolveMarkdownAssetUrl: (imagesBaseUrl: unknown, relativePath: unknown) => string;
};
export type ReaderDownloadContext = {
    jobId?: string;
    jobPayload?: unknown;
    manifestPayload?: unknown;
};
export type ReaderDownloadUrls = {
    source: any;
    sideBySide: string;
    translated: string;
};
export type ReaderDownloadAdapters = {
    resolveReaderDownloadUrls: (context?: ReaderDownloadContext) => ReaderDownloadUrls;
    resolveReaderDownloadName: (action: string, context: ReaderDownloadContext) => string;
    downloadProtectedResource: (fetchProtected: typeof fetch, url: string, fallbackName: string, preferredName?: string, onStatus?: ((status: unknown) => void) | null, onBusy?: ((busy: boolean, status?: string) => void) | null) => Promise<unknown>;
    failDownloadToast: (message?: string) => void;
};
export type ReaderFavoritesAdapters = {
    apiPrefix?: string;
    fetchDocumentByJobId: (apiPrefix: string, jobId: string) => Promise<{
        document_id?: string;
        active_job_id?: string | null;
        active_version_id?: string | null;
    } | null>;
    createFavorite: (apiPrefix: string, payload: Record<string, unknown>) => Promise<any>;
    fetchFavorites: (apiPrefix: string, options?: {
        documentId?: string;
    }) => Promise<{
        favorites?: any[];
    }>;
    deleteFavorite: (apiPrefix: string, favoriteId: string) => Promise<unknown>;
};
export type ReaderCredentialsPort = {
    getCredentials?: () => {
        modelApiKey?: string;
    } | null;
};
export type ReaderCredentialsAdapters = {
    credentialsPort: ReaderCredentialsPort;
};
export type ReaderAiAdapters = {
    /** Canonical /ai/ask client supplied by the host (SSE + credentials). */
    askDocumentAi: (options: Record<string, unknown>) => Promise<any>;
};
export type ReaderAdapters = ReaderSessionAdapters & ReaderMarkdownAdapters & ReaderDownloadAdapters & ReaderFavoritesAdapters & ReaderCredentialsAdapters & ReaderAiAdapters;
export declare const DEFAULT_READER_ADAPTERS: Partial<ReaderAdapters>;
export declare function setReaderAdapters(a: ReaderAdapters | null): void;
export declare function getReaderAdapters(): ReaderAdapters | null;
export declare function requireAdapter<T extends keyof ReaderAdapters>(key: T): NonNullable<ReaderAdapters[T]>;
//# sourceMappingURL=adapters.d.ts.map