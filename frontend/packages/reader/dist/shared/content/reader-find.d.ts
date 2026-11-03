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
//# sourceMappingURL=reader-find.d.ts.map