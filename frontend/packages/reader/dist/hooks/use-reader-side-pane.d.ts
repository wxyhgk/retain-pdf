import type { ReaderAnchor, ReaderAnchorJump, ReaderMarginMarker, ReaderMarginMarkerTone, ReaderSidePaneApi, ReaderSidePanePort } from "../contracts/side-pane.js";
import { type ReaderRegion } from "../shared/data/reader-regions.js";
/** 一个圆点落在哪一页、挂在哪一块上（找不到块就画在页顶）。 */
export type ResolvedMarginMarker = {
    key: string;
    page: number;
    itemId: string | null;
    tone: ReaderMarginMarkerTone;
    hollow: boolean;
    label: string;
};
export type MarginMarkersByPage = ReadonlyMap<number, readonly ResolvedMarginMarker[]>;
/** 锚点 → 书里的那一块：块编号优先，其次「那一页上的这段原文」。 */
export declare function resolveAnchorRegion(regions: readonly ReaderRegion[], anchor: ReaderAnchor): ReaderRegion | null;
export declare function resolveMarginMarkers(regions: readonly ReaderRegion[], markers: readonly ReaderMarginMarker[], pane: "source" | "translated"): MarginMarkersByPage;
export type ReaderSidePaneState = {
    port: ReaderSidePanePort | null;
    /** 这本书出不出这个页签。 */
    available: boolean;
    label: string;
    /** 给宿主内容的能力；没打开时为 null。 */
    api: ReaderSidePaneApi | null;
    /** 开着时按页分好的小圆点；关着时是空的（原文 / 对照 / 译文里不画）。 */
    markersByPage: MarginMarkersByPage;
    selectMarker: (key: string) => void;
};
export declare function useReaderSidePane(input: {
    port: ReaderSidePanePort | null | undefined;
    open: boolean;
    documentId: string;
    jobId: string;
    currentPage: number;
    regions: readonly ReaderRegion[];
    pane: "source" | "translated";
    jumpToAnchor: (target: {
        block_id?: string;
        page?: number;
        snippet?: string;
    }) => ReaderAnchorJump;
    close: () => void;
}): ReaderSidePaneState;
//# sourceMappingURL=use-reader-side-pane.d.ts.map