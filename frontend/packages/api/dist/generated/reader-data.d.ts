import type { JobFilesView, LiveTranslationLayout, LiveTranslationPageSnapshot, MarkdownDocumentView, ReaderMetadataView, ReaderRegionsView } from "@retainpdf/contracts/reader-data";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/jobs/:job_id/files */
export declare function listJobFiles(apiPrefix: string | undefined, args: {
    job_id: string;
}, options?: RequestOptions): Promise<JobFilesView>;
/** GET /api/v1/jobs/:job_id/reader/markdown */
export declare function getReaderMarkdown(apiPrefix: string | undefined, args: {
    job_id: string;
}, options?: RequestOptions): Promise<MarkdownDocumentView>;
/** GET /api/v1/jobs/:job_id/reader/regions */
export declare function getReaderRegions(apiPrefix: string | undefined, args: {
    job_id: string;
}, options?: RequestOptions): Promise<ReaderRegionsView>;
/** GET /api/v1/jobs/:job_id/reader/metadata */
export declare function getReaderMetadata(apiPrefix: string | undefined, args: {
    job_id: string;
}, options?: RequestOptions): Promise<ReaderMetadataView>;
/** GET /api/v1/jobs/:job_id/progress/layout */
export declare function getLiveLayout(apiPrefix: string | undefined, args: {
    job_id: string;
}, options?: RequestOptions): Promise<LiveTranslationLayout>;
/** GET /api/v1/jobs/:job_id/progress/pages/:page */
export declare function getLivePage(apiPrefix: string | undefined, args: {
    job_id: string;
    page: string;
}, options?: RequestOptions): Promise<LiveTranslationPageSnapshot>;
