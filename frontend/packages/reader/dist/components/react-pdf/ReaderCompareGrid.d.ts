import { type ReactElement } from "react";
import type { ReactNode } from "react";
import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import type { PageRowHeights } from "../../pdf/usePageRowSync.js";
import { type ReaderMetadata, type ReaderRegion } from "../../shared/data/reader-regions.js";
import type { LiveTranslationState } from "../../shared/data/live-translation-state.js";
import type { ReaderPaneComposition } from "../../app/pane-composition.js";
export type ReaderCompareGridProps = {
    mode?: string;
    /** 以下 controller 透传值缺省时从 reader context 取 */
    bindShell?: (node: HTMLDivElement | null) => void;
    shellEl?: HTMLElement | null;
    userZoom?: number;
    compareMode?: boolean;
    /** 阅读区全宽（shell），用于 zoom% 相对整屏计算 */
    shellWidth?: number;
    rowHeights?: PageRowHeights;
    mountSource?: boolean;
    mountTranslated?: boolean;
    showSource?: boolean;
    showTranslated?: boolean;
    /** 「无可并排的最终译文」；仅决定源文件缺失文案，不是 FAB 的 sourceOnly */
    sourceViewOnly?: boolean;
    sourceUrl?: string;
    translatedUrl?: string;
    sourceFile?: ProtectedPdfFile | null;
    translatedFile?: ProtectedPdfFile | null;
    onMetrics?: () => void;
    onNumPagesChange?: (pages: number, pane: "source" | "translated") => void;
    activeRegion?: ReaderRegion | null;
    regions?: ReaderRegion[];
    readerMetadata?: ReaderMetadata | null;
    markdownSplit?: boolean;
    assistantSplit?: boolean;
    liveTranslation?: LiveTranslationState;
    /** 源栏右上角动作（如「译文」叠加开关）；挂在 pane="source" 容器内。 */
    sourcePaneAction?: ReactNode;
    /**
     * 单一真值：是否把流式实时译文叠加到原文 PDF 上。
     * 仅当实时译文可用（最终译文 PDF 未就绪）时为 true；就绪后恒为 false。
     */
    overlayOnSource?: boolean;
    /**
     * 可见台面判别联合（单一真源）。提供时覆盖 mode/compareMode/
     * showSource/showTranslated/overlayOnSource 这几个散落输入。
     */
    paneComposition?: ReaderPaneComposition;
};
export declare function resolveReaderGridPresentation({ mode, compareMode, showSource, showTranslated, markdownSplit, overlayOnSource, }: Pick<ReaderCompareGridProps, "mode" | "compareMode" | "showSource" | "showTranslated"> & {
    markdownSplit: boolean;
    overlayOnSource?: boolean;
}): {
    mode: string;
    compareMode: boolean;
    showSource: boolean;
    showTranslated: boolean;
};
/** 页宽的基准。
 *
 * 开着侧栏时用双倍 shell 宽 —— 这样 50% 缩放恰好铺满 PDF 那一栏（见调用处的
 * 注释）。
 *
 * # 原来那个 viewport 封顶是错的
 *
 * 曾经是 `Math.min(shellWidth * 2, viewportWidth)`，注释说封顶是为了压掉
 * 「ResizeObserver 晚一帧」造成的一次闪动。但分栏是**可拖的**（30%–65%），
 * 于是在 30%–50% 这半个区间里 `shellWidth * 2 > viewport`，基准被钳成常量：
 *
 *     面板 30%  shell 1344  基准 1920(封顶)  50%页宽 936   栏宽 1344
 *     面板 40%  shell 1152  基准 1920(封顶)  50%页宽 936   栏宽 1152
 *     面板 50%  shell  960  基准 1920        50%页宽 936   栏宽  960  ← 只有这里对
 *     面板 65%  shell  672  基准 1344        50%页宽 648   栏宽  672
 *
 * 用户看到的：把分隔条往右拖给 PDF 更多地方，**页面一点都不变大**，两侧白边
 * 越拖越宽；反方向拉却会跟着缩小。同一根分隔条，两个方向行为不对称。
 *
 * 一个**瞬态**护栏被写成了稳态上限。那一帧的闪动现在由 PdfDocumentPane 的
 * 200ms settle 吸收（见 resolveReaderWidthCommit），不需要在这里封顶。
 *
 * viewportWidth 参数保留：调用方仍然传，但只在 shell 还没量出来时兜底。
 */
export declare function resolveReaderPageWidthBasis(shellWidth: number, sidePanelSplit: boolean, viewportWidth?: number): number;
export declare function liveTranslationPendingCopy(state: LiveTranslationState | undefined): string;
export declare function ReaderCompareGrid(props: ReaderCompareGridProps): ReactElement;
//# sourceMappingURL=ReaderCompareGrid.d.ts.map