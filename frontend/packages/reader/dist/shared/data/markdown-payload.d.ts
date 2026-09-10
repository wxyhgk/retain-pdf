export type NormalizedMarkdownPayload = {
    payload: any;
    content: string;
    imagesBaseUrl: string;
    ready: boolean;
};
/**
 * Translation jobs can reuse OCR artifacts owned by an earlier job. In that
 * case the translation job has PDFs and translations, while Markdown remains
 * under the source OCR job. Resolve that ownership link from the public job
 * detail without coupling the Reader to a particular API envelope version.
 */
export declare function resolveLinkedMarkdownJobId(payload: any, currentJobId?: string): string;
export declare function normalizeMarkdownPayload(payload: any): NormalizedMarkdownPayload;
export declare function hasMarkdownContent(payload: any): boolean;
export declare function loadMarkdownPayloadWithFallback(loadDocument: () => Promise<any>, loadLegacy: () => Promise<any>): Promise<any>;
//# sourceMappingURL=markdown-payload.d.ts.map