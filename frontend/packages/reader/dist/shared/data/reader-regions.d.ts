import type { ReaderPaneId } from "../../pdf/reader-dom-contract.js";
export type ReaderRegionBox = {
    page: number;
    bbox: [number, number, number, number];
    unit: "pdf_point";
    origin: "top_left" | "bottom_left";
    text: string;
};
export type ReaderRegion = {
    itemId: string;
    source: ReaderRegionBox;
    translated: ReaderRegionBox;
    markdown: string;
    regionType: string;
    status: string;
    assetIds: string[];
    assetUrls: string[];
};
export type ReaderRegionKind = "formula" | "table" | "figure" | "text" | "region";
export type ReaderRegionSelection = {
    selectionType: "region";
    region: ReaderRegion;
    kind: ReaderRegionKind;
    page: number;
    pane: ReaderPaneId;
    /** 视口坐标，用于浮条定位。 */
    rect: ReaderRegionRect;
};
export type ReaderTextSelection = {
    selectionType: "text";
    quote: string;
    page: number;
    pane: ReaderPaneId;
    /** 视口坐标，用于浮条定位。 */
    rect: ReaderRegionRect;
};
export type ReaderSelection = ReaderRegionSelection | ReaderTextSelection;
export type ReaderPageMetadata = {
    page: number;
    width: number;
    height: number;
};
export type ReaderDocumentMetadata = {
    pageCount: number;
    pages: ReaderPageMetadata[];
};
export type ReaderMetadata = {
    source: ReaderDocumentMetadata | null;
    translated: ReaderDocumentMetadata | null;
};
export type ReaderRegionHighlight = {
    itemId: string;
    region: ReaderRegion;
    box: ReaderRegionBox;
    pageSize: ReaderPageMetadata;
};
export type ReaderRegionRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};
export declare function normalizeReaderRegions(payload: unknown): ReaderRegion[];
export declare function readerRegionKind(regionType: string): ReaderRegionKind;
export declare function readerRegionKindForRegion(region: ReaderRegion): ReaderRegionKind;
export declare function isStructuredReaderRegion(region: ReaderRegion): boolean;
export declare function readerRegionContent(region: ReaderRegion, pane: ReaderPaneId): string;
export declare function extractReaderFormulaLatex(value: string): string;
export declare function normalizeReaderMetadata(payload: unknown): ReaderMetadata;
export declare function findReaderRegion(regions: readonly ReaderRegion[], blockId: string | null | undefined): ReaderRegion | null;
type ReaderCitationTarget = {
    block_id?: string;
    page_idx?: number;
    page?: number;
    snippet?: string;
};
/**
 * Resolve legacy Markdown fallback citations (md-xxxx, no page_idx) against
 * the structured region layer. The same region coordinates work for source
 * and translated PDFs, so one match restores navigation in either pane.
 */
export declare function findReaderRegionByCitation(regions: readonly ReaderRegion[], citation: ReaderCitationTarget | null | undefined): ReaderRegion | null;
/** Match an AI-rendered image back to its structured PDF region. */
export declare function findReaderRegionByAssetUrl(regions: readonly ReaderRegion[], assetUrl: string | null | undefined, page?: number | null): ReaderRegion | null;
export declare function regionBoxForPane(region: ReaderRegion, pane: ReaderPaneId): ReaderRegionBox;
export declare function resolveReaderRegionHighlight(region: ReaderRegion | null | undefined, metadata: ReaderMetadata | null | undefined, pane: ReaderPaneId): ReaderRegionHighlight | null;
export declare function projectReaderRegion(highlight: ReaderRegionHighlight | null | undefined, renderedWidth: number, renderedHeight: number): ReaderRegionRect | null;
export {};
//# sourceMappingURL=reader-regions.d.ts.map