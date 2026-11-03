export type UrlReaderAnchor = {
    pageIdx: number | null;
    blockId: string;
};
/** page_idx (0-based) → 阅读器页码 (1-based)；无效返回 null */
export declare function pageNumberFromUrlAnchor(anchor: UrlReaderAnchor | null | undefined, resolveBlockPage?: (blockId: string) => number | null): number | null;
/**
 * 去重键：混入会话身份（jobId/documentId），跨文档同 anchor 不再互相吞跳。
 * 同会话同 anchor 保持稳定，仍只跳一次。
 */
export declare function buildUrlAnchorAppliedKey(anchor: UrlReaderAnchor | null | undefined, page: number | null, session?: {
    jobId?: string | null;
    documentId?: string | null;
}): string;
/** 阅读位置写回 URL 的防抖窗口 */
export declare const DEFAULT_URL_PAGE_SYNC_DEBOUNCE_MS = 400;
export type UrlAnchorJumpOptions = {
    /** boot 完成、可滚动 */
    enabled: boolean;
    numPages: number;
    goToPage: (page: number) => void;
    resolveBlockPage?: (blockId: string) => number | null;
    onAnchorApplied?: (anchor: UrlReaderAnchor, page: number) => void;
    /** 会话身份：跨文档同 anchor 不跳的根因，缺席时退化为旧全局去重 */
    jobId?: string | null;
    documentId?: string | null;
    /**
     * 块（regions）到了没有：它们不挡着露页面，比页面晚到。只给了 block_id 的锚点要等它们才知道是哪一页；
     * 同时给了 page_idx 的先按页跳，块到了再按块所在的页校一次。缺省当已经到了（旧行为）。
     */
    regionsSettled?: boolean;
};
/**
 * 在 enabled 且 numPages 可用时，按 URL 锚点跳一次（每会话一次）。
 */
export declare function useUrlAnchorJump(options: UrlAnchorJumpOptions): void;
/**
 * 把 reader 自身 location 的 query 替换成 search。
 * 只写当前 window（软阅读 iframe 内即 iframe 自己），绝不触碰父页 URL。
 */
export declare function replaceReaderLocationSearch(search: string): void;
export type UrlReaderAnchorSyncOptions = UrlAnchorJumpOptions & {
    /** 阅读位置已就绪、可写回 URL */
    syncEnabled: boolean;
    /** 当前页（1 基） */
    currentPage: number;
    syncDebounceMs?: number;
    /** 测试 / 宿主注入；默认写 reader 自身 location 的 history.replaceState */
    applyReaderSearch?: (search: string) => void;
};
/**
 * 组合锚点读取跳转 + 阅读位置写回 URL。
 * 两条方向共享同一个 appliedKeyRef，保证写回值不会被当成待跳锚点。
 */
export declare function useReaderUrlAnchorSync(options: UrlReaderAnchorSyncOptions): void;
//# sourceMappingURL=use-url-anchor-jump.d.ts.map