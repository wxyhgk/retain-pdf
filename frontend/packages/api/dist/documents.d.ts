import type { ApplyDocumentMetadataSuggestionInput, CoverageJobView, CoverageSegment, CreateDocumentMetadataSuggestionInput, DocumentDeleteResultView, DocumentListView, DocumentMetadataEvidenceView, DocumentMetadataSuggestionApplyView, DocumentMetadataSuggestionView, DocumentReadingView, DocumentRecord, DocumentTitleCandidateView, PatchDocumentInput, PatchTranslationVersionInput, TranslationCoverageView, TranslationVersionView, TranslationVersionsView } from "@retainpdf/contracts/library-documents";
export type { ApplyDocumentMetadataSuggestionInput, CreateDocumentMetadataSuggestionInput, DocumentDeleteResultView, DocumentListView, DocumentReadingView, DocumentRecord, TranslationCoverageView, PatchTranslationVersionInput, TranslationVersionView, TranslationVersionsView, };
/** 阅读状态只有这三种，PATCH 时写别的后端回 400。 */
export type DocumentReadingStatus = NonNullable<PatchDocumentInput["reading_status"]>;
export type DocumentMetadataEvidence = DocumentMetadataEvidenceView;
export type DocumentTitleCandidate = DocumentTitleCandidateView;
export type DocumentMetadataSuggestion = DocumentMetadataSuggestionView;
export type TranslationCoverageSegment = CoverageSegment;
export type TranslationCoverageJob = CoverageJobView;
export type DocumentListQuery = {
    limit?: number;
    offset?: number;
    readingStatus?: string;
    collectionId?: string;
    /** 服务端标题/原始文件名包含匹配（后端 LIKE，已转义 %/_）。空串不发送。 */
    q?: string;
};
export type DocumentJobSummary = Record<string, any> & {
    job_id?: string;
    workflow?: string;
    status?: string;
    ocr_reused?: boolean;
    source_artifact_job_id?: string | null;
    stages?: DocumentJobStages;
};
export type DocumentJobStageState = "reused" | "queued" | "pending" | "in_progress" | "completed" | "failed" | "skipped";
export type DocumentJobStages = {
    ocr?: {
        state?: DocumentJobStageState;
        [key: string]: unknown;
    };
    translation?: {
        state?: DocumentJobStageState;
        [key: string]: unknown;
    };
    render?: {
        state?: DocumentJobStageState;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};
export type DocumentJobSubmissionView = {
    job_id: string;
    workflow: string;
    status: string;
    ocr_reused: boolean;
    source_artifact_job_id?: string | null;
    stages?: DocumentJobStages;
    [key: string]: unknown;
};
export type DocumentJobsView = {
    items: DocumentJobSummary[];
    invocation_summary?: Record<string, unknown>;
    total?: number;
    limit?: number;
    offset?: number;
    has_more?: boolean;
};
export type DocumentJobsQuery = {
    limit?: number;
    offset?: number;
};
export interface DocumentRequestError extends Error {
    status?: number;
    errorCode?: string;
    reason?: string;
    canFallbackToOcr?: boolean;
}
export declare function fetchDocumentList(apiPrefix: string, { limit, offset, readingStatus, collectionId, q }?: DocumentListQuery): Promise<DocumentListView>;
export declare function fetchDocumentByJobId(apiPrefix: string, jobId: string): Promise<DocumentRecord | null>;
export declare function fetchDocument(apiPrefix: string, documentId: string): Promise<DocumentRecord>;
export declare function patchDocument(apiPrefix: string, documentId: string, payload?: PatchDocumentInput): Promise<DocumentRecord>;
/** GET /documents/:id/reading —— 阅读器该打开哪个任务。给了 version 就是那个译文版本的（阅读页「对比版本」用）。 */
export declare function fetchDocumentReading(apiPrefix: string, documentId: string, { version }?: {
    version?: string;
}): Promise<DocumentReadingView>;
/** GET /documents/:id/translation-versions —— 一本书的几份译文和当前选的哪份（null = 自动，逐页取最新）。 */
export declare function fetchTranslationVersions(apiPrefix: string, documentId: string, { includeHidden }?: {
    includeHidden?: boolean;
}): Promise<TranslationVersionsView>;
/** PUT /documents/:id/translation-version —— 换当前版本；null 回到自动。隐藏的版本 409，带后端的原因。 */
export declare function setCurrentTranslationVersion(apiPrefix: string, documentId: string, versionId: string | null): Promise<TranslationVersionsView>;
/** PATCH /documents/:id/translation-versions/:version_id —— 改名（空串清掉）、隐藏或恢复。 */
export declare function patchTranslationVersion(apiPrefix: string, documentId: string, versionId: string, payload: PatchTranslationVersionInput): Promise<TranslationVersionsView>;
/** GET /documents/:id/translation-coverage —— 一本书翻了哪些页、每次任务提供了几页。 */
export declare function fetchDocumentTranslationCoverage(apiPrefix: string, documentId: string): Promise<TranslationCoverageView>;
export declare function createDocumentMetadataSuggestion(apiPrefix: string, documentId: string, payload?: CreateDocumentMetadataSuggestionInput): Promise<DocumentMetadataSuggestion>;
export declare function fetchDocumentMetadataSuggestions(apiPrefix: string, documentId: string, { limit }?: {
    limit?: number;
}): Promise<DocumentMetadataSuggestion[]>;
export declare function applyDocumentMetadataSuggestion(apiPrefix: string, documentId: string, suggestionId: string, payload?: ApplyDocumentMetadataSuggestionInput): Promise<DocumentMetadataSuggestionApplyView>;
export declare function deleteDocument(apiPrefix: string, documentId: string, { force }?: {
    force?: boolean;
}): Promise<DocumentDeleteResultView>;
export declare function translateDocument(apiPrefix: string, documentId: string, payload?: Record<string, unknown>): Promise<DocumentJobSubmissionView>;
export declare function ocrDocument(apiPrefix: string, documentId: string, payload?: Record<string, unknown>): Promise<any>;
export declare function submitDocument(apiPrefix: string, documentId: string, payload?: Record<string, unknown>): Promise<DocumentJobSubmissionView>;
export declare function fetchDocumentJobs(apiPrefix: string, documentId: string, { limit, offset }?: DocumentJobsQuery): Promise<DocumentJobsView>;
