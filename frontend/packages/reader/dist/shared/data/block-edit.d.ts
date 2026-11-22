import { type ReaderRegion } from "./reader-regions.js";
type Row = Record<string, unknown>;
/** 拼出来的书（多次翻译按页合成的虚拟任务 merged-…）是只读的，改要改到源任务上，这一版不支持。 */
export declare function isMergedReadingJob(jobId: string): boolean;
/** 块号里的页码（p012-b0005 → 12）；认不出是 0。 */
export declare function pageOfReaderItem(readerItemId: string): number;
/**
 * 编辑框里放什么：PATCH 要的是和条目 protected_translated_text 同一种写法（公式写成 $…$），
 * 所以优先拿它；老条目没有就用 translated_text。
 */
export declare function editableTranslation(item: Row | null | undefined): {
    source: string;
    translated: string;
};
export declare const REVISION_SOURCE_LABELS: Record<string, string>;
export type RevisionEntry = {
    /** 这一版的文字。 */
    text: string;
    /** 「初译」或「手改」「精修」…… */
    label: string;
    /** 写回时间（ISO），初译没有。 */
    ts: string;
    reason: string;
};
/**
 * 一块的修订历史，新的在前：每次写回的新文字，最后是第一次写回之前的那份（「初译」）。
 * 没有修订记录时是空的（当前译文就是初译，不用列）。
 */
export declare function revisionHistory(payload: unknown): RevisionEntry[];
/** 修订时间：11月19日 14:02（本地时间）；认不出原样给。 */
export declare function revisionTime(ts: string): string;
/** 这份译文 PDF 是什么时候排好的：任务最后一次跑完的时间。 */
export declare function jobRenderedAt(jobPayload: unknown): string;
/**
 * 还没排进 PDF 的改动：PDF 排好以后才写回的修订，每块取最后一次的文字（阅读页块号 → 文字）。
 * 关掉阅读页再打开也能接上「改了几处、还没排版」，PDF 上照样先盖着新译文。
 */
export declare function pendingEditsFromRevisions(payload: unknown, renderedAt: string): Map<string, string>;
/** 保存没通过检查时的一条问题，说成人话；警告不拦保存，不列。 */
export declare function revisionIssueTexts(issues: unknown): string[];
/** 这种块能不能「改」（悬停框的「改」、按 E 都看它）。 */
export declare function canEditReaderKind(kind: string): boolean;
/** 这一块能不能「改」；块号在 regions 里找不到时不拦（regions 还没到的时候照旧能改正文）。 */
export declare function isEditableReaderBlock(regions: readonly ReaderRegion[] | null | undefined, itemId: string): boolean;
/** 能改的块（正文、公式）按阅读顺序排好，给「上一段 / 下一段」用。 */
export declare function editableBlockIds(regions: readonly ReaderRegion[] | null | undefined): string[];
/** 编辑框够不够大：块够宽够高就直接盖在块上改，否则在旁边弹一个放大的框。 */
export declare const INLINE_EDIT_MIN_WIDTH = 300;
export declare const INLINE_EDIT_MIN_HEIGHT = 72;
export type InlineEditLayout = {
    mode: "inline";
    left: number;
    top: number;
    width: number;
    minHeight: number;
} | {
    mode: "popout";
    left: number;
    width: number;
    top?: number;
    bottom?: number;
};
/**
 * 编辑框放哪（页内坐标）：大块盖在原位，往下按内容长；小块（标题、单行、行间公式）在下面弹一个至少 360 宽的框，
 * 下面放不下（离页底不到 260）就放上面。左右夹在页里。
 */
export declare function inlineEditLayout(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
}, page: {
    width: number;
    height: number;
}): InlineEditLayout;
export {};
//# sourceMappingURL=block-edit.d.ts.map