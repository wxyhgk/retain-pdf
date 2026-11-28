import type { ReaderOutlineEntry } from "./reader-find.js";
/** PDF 书签的样子（和 pdf/pdf-outline.ts 的 PdfOutlineNode 一样；shared 不往上引 pdf/，这里只写用到的几项）。 */
export type ReaderTocSourceNode = {
    id: string;
    title: string;
    page: number | null;
    level: number;
    children: readonly ReaderTocSourceNode[];
};
export type ReaderTocNode = {
    id: string;
    title: string;
    /** 跳到第几页；书签的去处解析不出来时为 null（照样列出，点了不跳）。 */
    page: number | null;
    /** 按标题来的目录：跳到这一块（比只跳页准）。 */
    itemId?: string;
    /** 章是 1，节是 2；PDF 书签更深的层级摊进所在的章，深度照旧（卡片里多缩进一点）。 */
    depth: number;
};
export type ReaderTocChapter = ReaderTocNode & {
    children: ReaderTocNode[];
};
/** 超过这么多条（章 + 节）时短横线只画「全部章 + 当前章的节」。 */
export declare const TOC_COMPACT_BARS = 24;
/** 短横线最多画这么多根（章本身就很多时隔几章画一根，当前章一定画）。 */
export declare const TOC_MAX_BARS = 28;
/** 超过这么多条时目录卡顶上出过滤框。 */
export declare const TOC_FILTER_MIN = 15;
export declare function tocSize(chapters: readonly ReaderTocChapter[]): number;
/** 有 PDF 书签用书签，没有用认出的标题。书签只有一个根（整本书的书名）时拆开它，用它下面那一层当章。 */
export declare function readerToc(bookmarks: readonly ReaderTocSourceNode[], outline: readonly ReaderOutlineEntry[]): ReaderTocChapter[];
/**
 * 眼下这一页在哪一章、哪一节：页码不超过当前页、页码最大的那一条。同一页有好几条取第一条，
 * 只有章和它的节同页时标那一节（和 pdf-outline 的 currentBookmark 一个规矩：一串书签都指向目录页时不标最后那条）。
 */
export declare function tocCurrent(chapters: readonly ReaderTocChapter[], page: number): {
    chapterId: string | null;
    nodeId: string | null;
};
export type ReaderTocBar = {
    id: string;
    kind: "h1" | "h2";
    state: "current" | "chapter" | "";
};
/**
 * 左缘那排短横线：条目不多时章、节全画；多了（百页大书）只画全部章 + 当前章的节，不撑爆屏幕。
 * 章本身就多于 TOC_MAX_BARS 时隔几章画一根（当前章一定画）。
 */
export declare function tocBars(chapters: readonly ReaderTocChapter[], current: {
    chapterId: string | null;
    nodeId: string | null;
}): ReaderTocBar[];
/** 目录卡的过滤：章名中了列整章；只有节中了，列这一章和中了的节。 */
export declare function filterToc(chapters: readonly ReaderTocChapter[], query: string): ReaderTocChapter[];
//# sourceMappingURL=reader-toc.d.ts.map