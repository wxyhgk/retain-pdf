import { type ReaderRegionHighlight, type ReaderRegionRect } from "../shared/data/reader-regions.js";
export type ReaderTextHoverTarget = {
    itemId: string;
    highlight: ReaderRegionHighlight;
    rect: ReaderRegionRect;
};
export declare function projectReaderTextHoverTargets(regions: readonly ReaderRegionHighlight[], width: number, height: number): ReaderTextHoverTarget[];
export declare function hitTestReaderTextHoverTarget(targets: readonly ReaderTextHoverTarget[], x: number, y: number): ReaderTextHoverTarget | null;
export declare function ReaderTextHoverLayer({ target }: {
    target: ReaderTextHoverTarget | null;
}): import("react").JSX.Element;
//# sourceMappingURL=ReaderTextHoverLayer.d.ts.map