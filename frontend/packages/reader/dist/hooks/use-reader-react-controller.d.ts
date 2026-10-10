import { type RefObject } from "react";
import type { PageRowHeights } from "../pdf/usePageRowSync.js";
import type { ReaderMode, ReaderSessionState } from "./use-reader-session.js";
import type { ProtectedPdfFile } from "../pdf/useProtectedPdfFile.js";
import type { ReaderPaneModel } from "./use-reader-pane-model.js";
import { type ReaderRegion } from "../shared/data/reader-regions.js";
import { type RevisedBlocks } from "./use-reader-revised-blocks.js";
import type { LiveTranslationState } from "../shared/data/live-translation-state.js";
export declare const CITATION_HIGHLIGHT_MS = 2000;
/**
 * 无 region 命中时的页码回退：区分 0 基与 1 基来源再换算。
 * - number：视为 0 基 page_idx，+1；
 * - page_idx（0 基）：+1；
 * - page（1 基）：直用，page_idx 缺席时才看它；
 * - 非法/缺席返回 null。
 */
export declare function resolveReaderAnchorFallbackPage(target: ReaderAnchorTarget): number | null;
export type ReaderAnchorTarget = number | {
    page_idx?: number;
    page?: number;
    block_id?: string;
    image_url?: string;
    snippet?: string;
};
export type ReaderReactController = {
    session: ReaderSessionState;
    boot: ReaderSessionState["boot"];
    sourceOnly: boolean;
    mode: ReaderMode;
    userZoom: number;
    onZoomChange: (zoom: number) => void;
    shell: {
        bindShell: (node: HTMLDivElement | null) => void;
        shellEl: HTMLElement | null;
        shellWidth: number;
        shellRef: RefObject<HTMLDivElement | null>;
    };
    panes: ReaderPaneModel;
    sessionFiles: {
        sourceUrl: string;
        translatedUrl: string;
        sourceFile: ProtectedPdfFile | null;
        translatedFile: ProtectedPdfFile | null;
    };
    rowHeights: PageRowHeights;
    currentPage: number;
    goToPage: (page: number, pane?: "source" | "translated") => void;
    activeRegion: ReaderRegion | null;
    jumpToAnchor: (target: ReaderAnchorTarget, pane?: "source" | "translated") => void;
    setModeKeepingPage: (next: ReaderMode) => void;
    showHud: boolean;
    download: ReaderSessionState["download"];
    /** stable local persistence scope for reading position/layout */
    viewStateKey: string;
    liveTranslation: LiveTranslationState;
    liveTranslationAvailable: boolean;
    /** 改过的块（阅读页块编号 → 改过几次），译文栏画标记用。 */
    revisedBlocks: RevisedBlocks;
};
export declare function shouldTrackLiveTranslation(input: {
    jobId: string;
    sourceUrl: string;
    workflow: string;
}): boolean;
export declare function shouldEnableLiveTranslation(input: {
    jobId: string;
    sourceUrl: string;
    translatedUrl: string;
    jobStatus: string;
    workflow: string;
}): boolean;
export declare function useReaderReactController(): ReaderReactController;
//# sourceMappingURL=use-reader-react-controller.d.ts.map