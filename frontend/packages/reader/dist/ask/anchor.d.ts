import type { ReaderAskAnchor } from "../contracts/ask.js";
import { type PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { ReaderRegion } from "../shared/data/reader-regions.js";
/** 这一页在哪一节：有书签用书签，没有就用这一页及以前最近的标题块。 */
export declare function sectionForPage(bookmarks: readonly PdfOutlineNode[], regions: readonly ReaderRegion[], page: number): string;
/** 选中的字（只认书页文字层里的选区；输入框里的、页外的不算）。 */
export declare function selectedPageText(selection: Selection | null): {
    text: string;
    element: Element | null;
    rect: DOMRect | null;
};
export declare function buildAskAnchor({ pageElement, clientX, clientY, itemId, selection, regions, bookmarks, }: {
    /** 点到的那一页（[data-reader-page]）。 */
    pageElement: Element | null;
    clientX: number;
    clientY: number;
    /** 悬停框认出的块（没有就 null）。 */
    itemId: string | null;
    selection: string;
    regions: readonly ReaderRegion[];
    bookmarks: readonly PdfOutlineNode[];
}): ReaderAskAnchor | null;
//# sourceMappingURL=anchor.d.ts.map