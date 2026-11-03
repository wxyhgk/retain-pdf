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
/** 悬停框「摘到笔记」送出的一段：哪一块、原文在第几页，和点的时候的原文、译文。
 *  任务、书、书名由宿主补（宿主知道自己开的是哪个任务）。 */
export type ReaderNotesQuote = {
    itemId: string;
    /** 原文所在页，0 起。 */
    pageIdx: number;
    sourceText: string;
    /** 跨块、跨页接起来的段落是整段；还没翻译时为 null。 */
    translatedText: string | null;
};
export type ReaderNotesQuoteAdapters = {
    /** 「摘到笔记」：阅读页放在笔记（Studio）里、和它握过手时由宿主给。
     *
     * 包不认识笔记，也不认识消息怎么发，只问两件事：现在能不能摘（`available`，每次画悬停框时问），
     * 摘的时候把这一段交出去（`send`，返回有没有送出去）。不提供或 `available()` 为假 = 悬停框里不出这个按钮。 */
    notesQuote?: {
        available: () => boolean;
        send: (quote: ReaderNotesQuote) => boolean;
    };
};
/** 「笔记」按钮：阅读页放在笔记（Studio）里、Studio 认 open-notes 时由宿主给。开没开由 Studio 说了算，宿主转告。 */
export type ReaderNotesPanelState = {
    available: boolean;
    open: boolean;
    title: string | null;
};
export type ReaderNotesPanelAdapters = {
    /** 不提供或 `available` 为假 = 顶栏没有「笔记」按钮。`getState` 没变时返回同一个对象（给 useSyncExternalStore）。 */
    notesPanel?: {
        getState: () => ReaderNotesPanelState;
        subscribe: (listener: () => void) => () => void;
        toggle: () => void;
    };
};
/** 眼下读到哪：阅读页放在笔记（Studio）里时由宿主给，翻页就报（防抖、发不发由宿主管）。页从 0 起；页数还不知道时为 null。 */
export type ReaderReadingPositionAdapters = {
    readingPosition?: {
        report: (pageIdx: number | null, pageCount: number | null) => void;
    };
};
/** 阅读页的「AI」交给宿主：阅读页放在笔记（Studio）里、Studio 有自己的 AI（认 ask-ai）时由宿主给。
 *
 * `available()` 为真时点「AI」不再打开 dock 的终端面板，改调 `ask()`（宿主去打开它的 AI）；存着的终端面板也不再恢复。
 * 能不能用要等握手，所以有 `subscribe`。不提供 = 照旧打开终端。 */
export type ReaderHostAiAdapters = {
    hostAi?: {
        available: () => boolean;
        subscribe: (listener: () => void) => () => void;
        ask: () => boolean;
    };
};
/** 宿主让阅读页翻到某一段：阅读页放在笔记（Studio）里时由宿主给。
 *
 * 宿主收到「打开这一段」时先问这里登记的阅读页：是同一个任务、已经打开好的，就原地翻过去、返回 true，不用整页重开（PDF 不重新加载）；
 * 返回 false（别的书、还在加载）宿主照旧整页打开。不提供 = 一律整页打开。 */
export type ReaderHostNavigationAdapters = {
    hostNavigation?: {
        subscribe: (listener: (target: {
            jobId: string;
            pageIdx: number | null;
            blockId: string;
        }) => boolean) => () => void;
    };
};
export type ReaderAdapters = ReaderSessionAdapters & ReaderMarkdownAdapters & ReaderDownloadAdapters & ReaderDocumentIdentityAdapters & ReaderNotesQuoteAdapters & ReaderNotesPanelAdapters & ReaderReadingPositionAdapters & ReaderHostAiAdapters & ReaderHostNavigationAdapters;
/**
 * ReaderAdapters 声明键的运行时镜像（TS 类型在运行时被擦除）。
 * 注册层与门禁测试共用，避免手工复制字段集漂移；`satisfies` 保证不引入拼错键。
 * 完整性由紧随其后的编译期断言守护。
 */
export declare const READER_ADAPTER_KEYS: readonly ["isMockMode", "resolveResourceUrl", "fetchProtected", "resolvePdfjsVendorUrl", "defaultReaderDataPort", "defaultReaderPageConfigPort", "resolveReaderAnchor", "resolveReaderDocumentId", "resolveReaderJobId", "resolveReaderArtifactUrl", "resolveReaderSourcePdf", "resolveReaderTranslatedPdfUrl", "liveTranslation", "pdf", "sessionData", "resolveMarkdownAssetUrl", "resolveReaderDownloadUrls", "resolveReaderDownloadName", "downloadProtectedResource", "failDownloadToast", "apiPrefix", "fetchDocumentByJobId", "notesQuote", "notesPanel", "readingPosition", "hostAi", "hostNavigation"];
/** 必填（非 `?`）适配键子集，供门禁断言最小注入面。 */
export declare const READER_REQUIRED_ADAPTER_KEYS: readonly ["resolveMarkdownAssetUrl", "resolveReaderDownloadUrls", "resolveReaderDownloadName", "downloadProtectedResource", "failDownloadToast", "fetchDocumentByJobId"];
export declare function setReaderAdapters(a: ReaderAdapters | null): void;
export declare function getReaderAdapters(): ReaderAdapters | null;
export declare function requireAdapter<T extends keyof ReaderAdapters>(key: T): NonNullable<ReaderAdapters[T]>;
//# sourceMappingURL=adapters.d.ts.map