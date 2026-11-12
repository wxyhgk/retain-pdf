import type { ReaderRegion } from "../data/reader-regions.js";
export type ReaderOutlineEntry = {
    itemId: string;
    level: number;
    page: number;
    text: string;
};
export type ReaderSearchHit = {
    itemId: string;
    page: number;
    /** 命中在原文还是译文里（两边都有时算译文：读的是中文）。 */
    side: "source" | "translated";
    /** 命中前后的一截，`at`、`length` 是命中在这一截里的位置，给界面标出来。 */
    snippet: string;
    at: number;
    length: number;
};
/** 标题里的公式（`$\mathrm{H}_{2}\mathrm{O}$`）读成字（H₂O）：目录是一行字，不画公式。只管常见的几样，别的去掉记号照原样。 */
export declare function plainMath(text: string): string;
/** 标题块按阅读顺序排成目录；没有字、和上一条一样（跨栏拆开的同一个标题）的不要。 */
export declare function readerOutline(regions: readonly ReaderRegion[]): ReaderOutlineEntry[];
/** 目录里眼下这一页落在哪一条下面：页在它之后（含）的最后一条；在第一条之前是 -1。 */
export declare function currentOutlineIndex(entries: readonly ReaderOutlineEntry[], page: number): number;
/** 在每块的译文和原文里找（不分大小写），按阅读顺序，最多 `limit` 处。空的、只有空白的不找。 */
export declare function searchReaderRegions(regions: readonly ReaderRegion[], query: string, limit?: number): ReaderSearchHit[];
/**
 * 书页文字层里标出搜索词：给 react-pdf 的 customTextRenderer 用，返回这一段文字的 HTML（不分大小写，每处包一个
 * <mark class="reader-find-mark">）。只认落在同一段文字里的命中——pdf.js 把一行拆成好几段时，跨段的词标不出来，
 * 左栏的命中列表照样列得出。词是空的就原样（转义后）返回。
 */
export declare function highlightFindTerm(text: string, term: string): string;
/** 回车 / Shift+回车在命中之间走：从 current 往前或往后一处，到头绕回。没有命中是 -1。 */
export declare function stepFindHit(current: number, count: number, backwards: boolean): number;
//# sourceMappingURL=reader-find.d.ts.map