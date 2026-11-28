import { type ReactElement } from "react";
import { type ReaderMetadata, type ReaderRegion } from "../shared/data/reader-regions.js";
export type HtmlPageText = "translated" | "source";
/** 这一块要不要画成 HTML、画什么：正文类画字，行间公式画 LaTeX；图、表、认不出的不画（留原页的像素）。 */
export declare function htmlBlockContent(region: ReaderRegion, text: HtmlPageText): {
    kind: string;
    content: string;
} | null;
/** 按页分好的块（整本书只分一次）。 */
export declare function regionsByPage(regions: readonly ReaderRegion[]): ReadonlyMap<number, ReaderRegion[]>;
export declare function HtmlPageLayer({ page, width, height, regions, metadata, text, arrivedAt }: {
    page: number;
    width: number;
    height: number;
    /** 这一页的块。 */
    regions: readonly ReaderRegion[];
    metadata: ReaderMetadata | null;
    text: HtmlPageText;
    /** 刚打开（或换了画什么）的时候：每块按阅读顺序依次「浮出来」（第一个动效，沿用实时译文到达的那一下）。 */
    arrivedAt: number;
}): ReactElement | null;
//# sourceMappingURL=HtmlPageLayer.d.ts.map