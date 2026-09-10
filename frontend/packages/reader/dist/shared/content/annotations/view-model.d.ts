export declare const ANNOTATION_KIND_META: Readonly<{
    sentence: {
        label: string;
    };
    data: {
        label: string;
    };
    figure: {
        label: string;
    };
}>;
export type AnnotationKind = keyof typeof ANNOTATION_KIND_META;
export type AnnotationItem = {
    favoriteId?: string;
    documentId?: string;
    jobId?: string;
    pageIdx?: number;
    blockId?: string;
    kind?: string;
    quoteText?: string;
    translatedQuoteText?: string;
    note?: string;
    createdAt?: string;
    [key: string]: unknown;
};
export type AnnotationGroup = {
    pageIdx: number;
    items: AnnotationItem[];
};
export declare function sortAnnotations(list: unknown): AnnotationItem[];
export declare function groupAnnotationsByPage(list: unknown): AnnotationGroup[];
export declare function buildAnnotationsMarkdown({ title, annotations, }?: {
    title?: string;
    annotations?: unknown;
}): string;
export declare function annotationAnchor(annotation: AnnotationItem | null | undefined): {
    pageIdx?: number;
    blockId?: string;
};
//# sourceMappingURL=view-model.d.ts.map