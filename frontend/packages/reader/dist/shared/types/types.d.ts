/**
 * Minimal domain types for the reader: selection, favorites, anchors, geometry.
 * Shared by selection-favorites, favorites/*, region-interactions, server-favorites-port.
 * 共享真值（原 frontend/web/src/js/reader/types.ts），纯类型，无运行时依赖
 */
/** Axis-aligned rect in pixel coordinates (page-local or viewport). */
export interface PixelRect {
    left: number;
    top: number;
    width: number;
    height: number;
}
/** Normalized rect relative to page or viewport (0–1). */
export interface RelativeRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
/** Drag start/end points used while rubber-banding a selection. */
export interface DragRectInput {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}
export type ReaderPane = "source" | "translated" | (string & {});
export type ReaderMode = "source" | "translated" | "compare" | (string & {});
/** (pageIdx, blockId) anchor shared by jump / favorites / citations. pageIdx is 0-based. */
export interface PageAnchor {
    pageIdx?: number;
    blockId?: string;
}
/** Quote snapshot extracted from a page selection for server-side favorites. */
export interface SelectionQuote {
    pageIdx?: number;
    blockId?: string;
    quoteText?: string;
    translatedQuoteText?: string;
}
/** Runtime selection overlay state (DOM-backed). */
export interface ReaderSelection {
    id?: string;
    mode?: ReaderMode | string;
    page?: number;
    pane?: ReaderPane | string;
    pageElement?: Element | null;
    rect?: PixelRect | null;
    anchorRect?: PixelRect | null;
    baseRect?: PixelRect | null;
    sourceRect?: PixelRect | null;
    scale?: number;
    relativeRect?: RelativeRect | null;
    anchorRelativeRect?: RelativeRect | null;
    previewUrl?: string;
    overlay?: HTMLElement | null;
    note?: string;
    serverFavoriteId?: string;
}
/** Local stored favorite (clipping) — JSON-serializable fields plus optional DOM helpers. */
export interface FavoriteItem {
    id?: string;
    kind?: string;
    mode?: ReaderMode | string;
    page?: number;
    pane?: ReaderPane | string;
    rect?: PixelRect | null;
    anchorRect?: PixelRect | null;
    baseRect?: PixelRect | null;
    sourceRect?: PixelRect | null;
    scale?: number;
    relativeRect?: RelativeRect | null;
    anchorRelativeRect?: RelativeRect | null;
    previewUrl?: string;
    title?: string;
    note?: string;
    tags?: string[];
    pinned?: boolean;
    createdAt?: string;
    updatedAt?: string;
    serverFavoriteId?: string;
    /** Present only while restored into the live viewer. */
    pageElement?: Element | null;
}
/** Partial patch applied when editing favorite metadata (title/note/tags). */
export type FavoriteMetadataPatch = Partial<Pick<FavoriteItem, "title" | "note" | "tags" | "pinned">>;
/** Server favorite after snake_case → camelCase normalize. */
export interface ServerFavorite {
    favoriteId: string;
    documentId: string;
    jobId: string;
    pageIdx: number;
    blockId: string;
    kind: string;
    quoteText: string;
    translatedQuoteText: string;
    note: string;
    createdAt: string;
}
/** Raw favorite payload from the API (snake_case). */
export interface ServerFavoriteRaw {
    favorite_id?: string;
    document_id?: string;
    job_id?: string;
    page_idx?: number;
    block_id?: string;
    kind?: string;
    quote_text?: string;
    translated_quote_text?: string;
    note?: string;
    created_at?: string;
}
/** Create-favorite API response (subset used by the reader). */
export interface FavoriteApiRecord {
    favorite_id?: string;
    document_id?: string;
    job_id?: string;
    page_idx?: number;
    block_id?: string;
    kind?: string;
    quote_text?: string;
    translated_quote_text?: string;
    note?: string;
    created_at?: string;
}
export interface ReaderFavoritesStore {
    add(item: FavoriteItem): FavoriteItem[];
    list(): FavoriteItem[];
    save(items: FavoriteItem[]): void;
    storageKey: string;
}
export interface ReaderDrawerController {
    open?(name: string): string | void;
    toggle?(name: string): string | void;
    close?(name?: string): string | void;
    active?(): string;
    getActive?(): string;
}
export interface ReaderServerFavoritesPort {
    loadServerFavorites?(): Promise<ServerFavorite[]>;
    removeServerFavorite?(favoriteId: string): Promise<boolean>;
    syncFavorite?(quote: SelectionQuote): Promise<FavoriteApiRecord | null>;
    recreateFavoriteNote?(annotation: ServerFavorite, note?: string): Promise<ServerFavorite | null>;
    resolveDocumentId?(): Promise<string>;
}
export interface CreateReaderSelectionFavoritesOptions {
    documentRef?: Document;
    jobId?: string;
    drawerController?: ReaderDrawerController | null;
    root?: Element | null;
    setReaderMode?: ((mode: string) => void) | null;
    store?: ReaderFavoritesStore;
    resolveQuote?: ((args: {
        page?: number;
        rect?: PixelRect | null;
    }) => SelectionQuote | null) | null;
    serverFavoritesPort?: ReaderServerFavoritesPort | null;
    jumpToAnchor?: ((anchor: PageAnchor) => boolean | void) | null;
}
export interface SyncDrawerOptions {
    preserveScroll?: boolean;
}
export interface ClearActiveSelectionOptions {
    removeOverlay?: boolean;
}
export interface FavoriteSelectionOptions {
    openDrawer?: boolean;
}
export interface ReaderPositionSnapshot {
    mode: string;
    scrollLeft: number;
    scrollTop: number;
}
/** Mounted PDF viewer ready handle from pdf-controller. */
export interface ViewerReady {
    key: string;
    pagesCount: number;
    controller: {
        viewerElement?: Element | null;
        [key: string]: unknown;
    };
}
export interface ViewerPageState {
    currentPage: number;
    totalPages: number;
}
export interface ReaderPageStateSlice {
    reader: {
        totalPages: number;
        currentPage: number;
        primaryViewerKey: string;
    };
    progress?: {
        metadataReady: boolean;
        sourceDone: boolean;
        translatedDone: boolean;
    };
    bootProgressBar?: {
        value: number;
        target: number;
        rafId: number;
    };
}
export interface ReaderMetadataSide {
    page_count?: number;
}
export interface ReaderMetadata {
    source?: ReaderMetadataSide;
    translated?: ReaderMetadataSide;
}
export interface RegionsPayload {
    items?: unknown[];
}
export interface BindReaderInteractionsOptions {
    apiPrefix?: string;
    bindPrimary?: (controller: unknown, onPage: (pageNumber: number) => void) => void;
    bindRegions?: (args: Record<string, unknown>) => void;
    fetchTranslationItem?: ((...args: unknown[]) => Promise<unknown>) | null;
    getReaderMode?: () => string;
    jobId?: string;
    pageState?: ReaderPageStateSlice | null;
    /** Metadata may arrive untyped from boot/fetch; only page_count is read. */
    readerMetadata?: unknown;
    regionsPayload?: unknown;
    scheduleScale?: () => void;
    setIndicator?: (current: number, total: number) => void;
    sourceReady?: ViewerReady | null;
    translatedReady?: ViewerReady | null;
}
export interface PdfDocumentConfigPort {
    apiHeaders(): Record<string, string>;
}
export interface BuildPdfDocumentOptionsArgs {
    url?: string;
    configPort?: PdfDocumentConfigPort;
}
export interface LoadPdfDocumentArgs {
    itemOrUrl?: string | {
        resource_url?: string;
        resource_path?: string;
    } | null;
    configPort?: PdfDocumentConfigPort;
    fetchProtected?: ((url: string) => Promise<Response>) | null;
}
export interface AttachSelectionCloseOptions {
    onCollect?: (() => void) | null;
    onLocate?: (() => void) | null;
    onPeekEnd?: (() => void) | null;
    onPeekStart?: (() => void) | null;
}
export interface CreateServerFavoritesPortOptions {
    jobId?: string;
    apiPrefix?: string;
    documentByJobId?: (apiPrefix: string, jobId: string) => Promise<{
        document_id?: string;
    } | null>;
    submitFavorite?: (apiPrefix: string, payload: Record<string, unknown>) => Promise<FavoriteApiRecord>;
    loadFavorites?: (apiPrefix: string, opts?: {
        documentId?: string;
    }) => Promise<{
        favorites?: ServerFavoriteRaw[];
    }>;
    removeFavorite?: (apiPrefix: string, favoriteId: string) => Promise<unknown>;
}
/** Rect fragment accepted by AI payload builders (partial pixel rect). */
export type AiRectLike = Partial<PixelRect> & Record<string, unknown>;
/** Selection / page context attached to an AI question. */
export interface ReaderAiSelectionContext {
    page?: number | string | null;
    rect?: AiRectLike | null;
    mode?: ReaderMode | string;
    /** Nested selection payload sometimes already shaped for the API. */
    selection?: {
        page?: number | string | null;
        rect?: AiRectLike | null;
        [key: string]: unknown;
    } | null;
    [key: string]: unknown;
}
export type ReaderAiScope = "document" | "page" | "selection" | (string & {});
/** One turn stored in multi-session chat history. */
export interface ReaderAiChatMessage {
    role?: string;
    text?: string;
    [key: string]: unknown;
}
/** Multi-turn history item returned to the remote AI chat API. */
export interface ReaderAiChatHistoryTurn {
    role?: string;
    content?: string;
    text?: string;
    [key: string]: unknown;
}
/** One AI conversation session (messages for UI + history for the API). */
export interface ReaderAiChatSession {
    id?: string;
    title?: string;
    createdAt?: number;
    updatedAt?: number;
    messages?: ReaderAiChatMessage[];
    history?: ReaderAiChatHistoryTurn[];
    [key: string]: unknown;
}
export interface ReaderAiSessionsBag {
    sessions?: ReaderAiChatSession[];
    activeId?: string;
}
/** Session row used by the sessions dropdown. */
export interface ReaderAiSessionSummary {
    id: string;
    title: string;
    updatedAt: number;
    messageCount: number;
    active: boolean;
}
export interface CreateReaderAiContextOptions {
    documentRef?: Document | null;
    drawerController?: ReaderDrawerController | null;
}
/** Callbacks for manual PDF page rendering. */
export interface ManualPageRenderCallbacks {
    onPageRendered?: () => void;
    onScaleChanged?: () => void;
    onScaleRefresh?: () => void;
}
//# sourceMappingURL=types.d.ts.map