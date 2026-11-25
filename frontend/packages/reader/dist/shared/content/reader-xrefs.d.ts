import { type ReaderRegion } from "../data/reader-regions.js";
export type XrefKind = "figure" | "table" | "equation";
export type XrefTarget = {
    key: string;
    kind: XrefKind;
    label: string;
    /** 跳过去的那一块（图、表、公式；找不到就是图注）。 */
    itemId: string;
    /** 预览画的范围：图注加上它旁边连着的图 / 表 / 公式块（同一页），按阅读顺序。 */
    itemIds: string[];
    /** 图注那一段（没有图注的公式为空）。 */
    captionId: string;
};
export type XrefIndex = ReadonlyMap<string, XrefTarget>;
export declare const READER_XREF_CLASS = "reader-xref";
export declare const READER_XREF_ATTR = "data-xref";
/** 编号统一写法：去空白，各种横线换成 -。 */
export declare function normalizeXrefLabel(label: string): string;
export declare function buildXrefIndex(regions: readonly ReaderRegion[]): XrefIndex;
export type XrefMatch = {
    start: number;
    end: number;
    key: string;
};
/** 一段文字里认得出去处的引用（按出现顺序，不重叠）。 */
export declare function findXrefs(text: string, index: XrefIndex): XrefMatch[];
/**
 * 文字层一段字 → HTML：认出的引用包 <mark class="reader-xref" data-xref="figure:2.1">，搜索词照旧包 <mark>（highlightFindTerm）。
 */
export declare function renderXrefText(text: string, index: XrefIndex, findTerm?: string): string;
export declare function xrefTitle(target: XrefTarget): string;
//# sourceMappingURL=reader-xrefs.d.ts.map