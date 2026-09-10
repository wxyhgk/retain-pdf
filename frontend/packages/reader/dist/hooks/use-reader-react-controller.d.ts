import { type RefObject } from "react";
import { type ReaderToolsApi } from "./use-reader-tools.js";
import type { PageRowHeights } from "../pdf/usePageRowSync.js";
import type { ReaderMode, ReaderSessionState } from "./use-reader-session.js";
import type { ProtectedPdfFile } from "../pdf/useProtectedPdfFile.js";
import type { ReaderPaneModel } from "./use-reader-pane-model.js";
import { type ReaderRegion, type ReaderSelection, type ReaderRegionSelection } from "../shared/data/reader-regions.js";
import type { LiveTranslationState } from "../shared/data/live-translation-state.js";
export declare const CITATION_HIGHLIGHT_MS = 2000;
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
        compareColWidth: number;
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
    goToPage: (page: number) => void;
    activeRegion: ReaderRegion | null;
    jumpToAnchor: (target: ReaderAnchorTarget, pane?: "source" | "translated") => void;
    setModeKeepingPage: (next: ReaderMode) => void;
    showHud: boolean;
    tools: ReaderToolsApi;
    selection: ReaderSelection | null;
    clearSelection: () => void;
    selectRegion: (selection: ReaderRegionSelection) => void;
    documentTitle: string;
    download: ReaderSessionState["download"];
    /** stable local persistence scope for reading position/layout */
    viewStateKey: string;
    liveTranslation: LiveTranslationState;
    liveTranslationAvailable: boolean;
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