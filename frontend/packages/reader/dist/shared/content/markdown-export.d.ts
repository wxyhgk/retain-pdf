export type ReaderMarkdownExportAsset = {
    url: string;
    path: string;
};
export type ReaderMarkdownExport = {
    source: string;
    translated: string;
    bilingual: string;
    /** 有没有任何一块有译文：没有时宿主只放原文那一份。 */
    hasTranslation: boolean;
    /** 要放进 zip 的图片：原地址 → zip 里的路径（images/...），去重过。 */
    assets: ReaderMarkdownExportAsset[];
};
export declare function buildReaderMarkdownExport(regionsPayload: unknown): ReaderMarkdownExport | null;
//# sourceMappingURL=markdown-export.d.ts.map