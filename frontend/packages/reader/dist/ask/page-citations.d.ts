/** Markdown 里页码链接的地址前缀（remark 插件生成，markdown-text 的 a 组件认出来画成页码标签）。 */
export declare const PAGE_HREF_PREFIX = "#retainpdf-page=";
export type PageSegment = {
    type: "text";
    value: string;
} | {
    type: "page";
    page: number;
    value: string;
};
/** 一段字切成「字」和「页码」。pageCount 给了就只认 1…pageCount（超出的是正文里的别的数）。 */
export declare function splitPageRefs(text: string, pageCount?: number): PageSegment[];
export declare function pageFromHref(href: string | undefined): number | null;
type MdNode = {
    type: string;
    value?: string;
    url?: string;
    children?: MdNode[];
};
/** remark 插件：正文里的页码换成页码链接（不知道书有几页，越界的由页码标签自己当普通字显示）。 */
export declare function remarkPageCitations(): (tree: MdNode) => void;
export {};
//# sourceMappingURL=page-citations.d.ts.map