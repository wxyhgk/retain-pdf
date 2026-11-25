import type { createReaderDataPort } from "./runtime/data.js";
import type { createReaderPageConfigPort } from "./runtime/config.js";
import type { ReaderLiveTranslationPort } from "./contracts/live-translation.js";
import type { ReaderPdfPort } from "./contracts/pdf.js";
import type { ReaderSessionDataPort } from "./contracts/session.js";
export { hasMarkdownContent, loadMarkdownPayloadWithFallback, normalizeMarkdownPayload, } from "./shared/data/markdown-payload.js";
export type ReaderSessionAdapters = {
    isMockMode?: () => boolean;
    resolveResourceUrl?: (url: string) => string;
    fetchProtected?: typeof fetch;
    resolvePdfjsVendorUrl?: (relativePath?: string) => string;
    defaultReaderDataPort?: ReturnType<typeof createReaderDataPort>;
    defaultReaderPageConfigPort?: ReturnType<typeof createReaderPageConfigPort>;
    resolveReaderAnchor?: (...args: any[]) => any;
    resolveReaderDocumentId?: () => string;
    resolveReaderJobId?: () => string;
    resolveReaderArtifactUrl?: (...args: any[]) => string;
    resolveReaderSourcePdf?: (...args: any[]) => any;
    resolveReaderTranslatedPdfUrl?: (...args: any[]) => string;
    /** Optional during migration; hosts without live translation remain supported. */
    liveTranslation?: ReaderLiveTranslationPort;
    /** Optional during migration; legacy flat fields remain supported. */
    pdf?: ReaderPdfPort;
    /** Optional during migration; legacy data/runtime fields remain supported. */
    sessionData?: ReaderSessionDataPort;
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
    source: string;
    sideBySide: string;
    translated: string;
};
export type ReaderDownloadAdapters = {
    resolveReaderDownloadUrls: (context?: ReaderDownloadContext) => ReaderDownloadUrls;
    resolveReaderDownloadName: (action: string, context: ReaderDownloadContext) => string;
    downloadProtectedResource: (fetchProtected: typeof fetch, url: string, fallbackName: string, preferredName?: string, onStatus?: ((status: unknown) => void) | null, onBusy?: ((busy: boolean, status?: string) => void) | null) => Promise<unknown>;
    failDownloadToast: (message?: string) => void;
};
/** 文档身份查询。原来这块叫 ReaderFavoritesAdapters —— 收藏删掉之后只剩这两项，
 * 而它们是「按 jobId 反查文档」这件事，跟收藏无关。 */
export type ReaderDocumentIdentityAdapters = {
    apiPrefix?: string;
    fetchDocumentByJobId: (apiPrefix: string, jobId: string) => Promise<{
        document_id?: string;
        active_job_id?: string | null;
        active_version_id?: string | null;
    } | null>;
};
export type ReaderAdapters = ReaderSessionAdapters & ReaderMarkdownAdapters & ReaderDownloadAdapters & ReaderDocumentIdentityAdapters;
/**
 * ReaderAdapters 声明键的运行时镜像（TS 类型在运行时被擦除）。
 * 注册层与门禁测试共用，避免手工复制字段集漂移；`satisfies` 保证不引入拼错键。
 * 完整性由紧随其后的编译期断言守护。
 */
export declare const READER_ADAPTER_KEYS: readonly ["isMockMode", "resolveResourceUrl", "fetchProtected", "resolvePdfjsVendorUrl", "defaultReaderDataPort", "defaultReaderPageConfigPort", "resolveReaderAnchor", "resolveReaderDocumentId", "resolveReaderJobId", "resolveReaderArtifactUrl", "resolveReaderSourcePdf", "resolveReaderTranslatedPdfUrl", "liveTranslation", "pdf", "sessionData", "resolveMarkdownAssetUrl", "resolveReaderDownloadUrls", "resolveReaderDownloadName", "downloadProtectedResource", "failDownloadToast", "apiPrefix", "fetchDocumentByJobId"];
/** 必填（非 `?`）适配键子集，供门禁断言最小注入面。 */
export declare const READER_REQUIRED_ADAPTER_KEYS: readonly ["resolveMarkdownAssetUrl", "resolveReaderDownloadUrls", "resolveReaderDownloadName", "downloadProtectedResource", "failDownloadToast", "fetchDocumentByJobId"];
export declare function setReaderAdapters(a: ReaderAdapters | null): void;
export declare function getReaderAdapters(): ReaderAdapters | null;
export declare function requireAdapter<T extends keyof ReaderAdapters>(key: T): NonNullable<ReaderAdapters[T]>;
//# sourceMappingURL=adapters.d.ts.map