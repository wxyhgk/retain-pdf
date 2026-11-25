/** pdf.js PDFDocumentProxy 里用到的那几样（写成接口，测试用假的）。 */
export type PdfOutlineSource = {
    getOutline(): Promise<RawOutlineItem[] | null>;
    getDestination(name: string): Promise<unknown[] | null>;
    getPageIndex(ref: unknown): Promise<number>;
};
type RawOutlineItem = {
    title?: string;
    dest?: string | unknown[] | null;
    items?: RawOutlineItem[];
};
export type PdfOutlineNode = {
    /** 树里的位置（`0.2.1`），当 React key 和折叠状态用。 */
    id: string;
    title: string;
    /** 跳到第几页（从 1 数）；去处解析不出来时为 null（这一条照样显示，点了不跳）。 */
    page: number | null;
    /** 第几层，从 1 数。 */
    level: number;
    children: PdfOutlineNode[];
};
/** 太大的书签树（有的 PDF 每页一条）只读这么多条，免得卡。 */
export declare const OUTLINE_LIMIT = 3000;
export declare function readPdfOutline(pdf: PdfOutlineSource): Promise<PdfOutlineNode[]>;
/** 按树的顺序摊平（算「眼下在哪一节」、测试用）。 */
export declare function flattenOutline(nodes: readonly PdfOutlineNode[]): PdfOutlineNode[];
/**
 * 眼下这一页落在哪一条书签下：页码不超过当前页、页码最大的那一条。
 * 同一页有好几条时取树里第一条；只有它的下级也在同一页时才往下走（一章和它的第一节同页 → 标那一节）。
 * 有的 PDF 一串书签都指向同一页（比如都指向目录页），不能标成最后那条。返回 id；在第一条之前是 null。
 */
export declare function currentBookmark(nodes: readonly PdfOutlineNode[], page: number): string | null;
/** 一条书签的所有上级（id），打开目录时把眼下这一节的上级都展开。 */
export declare function ancestorIds(id: string | null): string[];
export {};
//# sourceMappingURL=pdf-outline.d.ts.map