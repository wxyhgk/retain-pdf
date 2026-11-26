import { type ReaderRegion } from "../data/reader-regions.js";
export type ReaderMdBlockKind = "heading" | "paragraph" | "formula" | "figure" | "table" | "caption" | "reference" | "footnote" | "meta";
export type ReaderMdBlock = {
    /** 第一块的 itemId，同时当 React key 和点击跳转目标。 */
    key: string;
    /** 跨页接续的一段会合成一块，这里是它包含的全部 itemId（悬停任何一截都算这块）。 */
    itemIds: string[];
    page: number;
    kind: ReaderMdBlockKind;
    /** 标题层级：1 = 文档标题，2 = 章节标题。 */
    level: number;
    source: string;
    /** 没有译文（公式、参考文献、保留原文的块）时等于 source。 */
    translated: string;
    hasTranslation: boolean;
    assetUrls: string[];
    /** 公式编号，例如 "(3)"：挂在紧挨着的那条公式上。 */
    label: string;
};
export type ReaderMdLanguage = "source" | "translated";
export declare function readerRegionsHaveReadingOrder(regions: readonly ReaderRegion[]): boolean;
export declare function buildReaderMdBlocks(regions: readonly ReaderRegion[]): ReaderMdBlock[] | null;
/** 这块要交给 Markdown 渲染器的源码（图片单独渲染，不走这里）。 */
export declare function readerMdBlockMarkdown(block: ReaderMdBlock, language: ReaderMdLanguage): string;
//# sourceMappingURL=reader-blocks.d.ts.map