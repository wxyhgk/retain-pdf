import type { ResolvedMarginMarker } from "../hooks/use-reader-side-pane.js";
export type MarginMarkerTarget = {
    itemId: string;
    rect: {
        top: number;
        height: number;
    };
};
/** 同一块上有好几个点时往下错开，不叠在一起。 */
export declare const MARGIN_MARKER_SIZE = 12;
export declare function marginMarkerTops(markers: readonly ResolvedMarginMarker[], targets: readonly MarginMarkerTarget[]): number[];
export declare function MarginMarkerLayer({ markers, targets, onSelect, }: {
    markers: readonly ResolvedMarginMarker[];
    targets: readonly MarginMarkerTarget[];
    onSelect?: (key: string) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=MarginMarkerLayer.d.ts.map