export type UrlReaderAnchor = {
    pageIdx: number | null;
    blockId: string;
};
/** page_idx (0-based) → 阅读器页码 (1-based)；无效返回 null */
export declare function pageNumberFromUrlAnchor(anchor: UrlReaderAnchor | null | undefined, resolveBlockPage?: (blockId: string) => number | null): number | null;
/**
 * 在 enabled 且 numPages 可用时，按 URL 锚点跳一次（每会话一次）。
 */
export declare function useUrlAnchorJump(options: {
    /** boot 完成、可滚动 */
    enabled: boolean;
    numPages: number;
    goToPage: (page: number) => void;
    resolveBlockPage?: (blockId: string) => number | null;
    onAnchorApplied?: (anchor: UrlReaderAnchor, page: number) => void;
}): void;
//# sourceMappingURL=use-url-anchor-jump.d.ts.map