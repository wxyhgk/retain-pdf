/** 引用悬停预览：「图 2.1」「式 (3.21)」上停一会儿，旁边浮出那张图 / 那个式子（RegionCanvas 重画，小号的放大框）。
 * 只看不点（pointer-events: none），移开就收；点引用本身跳过去。 */
import type { ReactElement } from "react";
import type { ReaderMetadata, ReaderRegion } from "../../shared/data/reader-regions.js";
import type { XrefPreview } from "../../hooks/use-reader-xrefs.js";
import { type ReaderZoomDocuments } from "./ReaderZoomViewer.js";
export declare const XREF_PREVIEW_WIDTH = 380;
/** 预览放哪：引用下方放得下就放下方，否则上方；左右不出屏。 */
export declare function placeXrefPreview(anchor: XrefPreview["anchor"], size: {
    width: number;
    height: number;
}, viewport: {
    width: number;
    height: number;
}): {
    left: number;
    top: number;
};
export declare function ReaderXrefPreview({ preview, regions, metadata, documents, }: {
    preview: XrefPreview;
    regions: readonly ReaderRegion[];
    metadata: ReaderMetadata | null;
    documents: ReaderZoomDocuments;
}): ReactElement | null;
//# sourceMappingURL=ReaderXrefPreview.d.ts.map