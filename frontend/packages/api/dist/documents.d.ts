export type DocumentRecord = Record<string, any> & {
    document_id?: string;
    title?: string;
    title_source?: "filename" | "pdf_metadata" | "ocr" | "ai" | "user" | string;
    title_locked?: boolean;
    updated_at?: string;
};
export type DocumentMetadataEvidence = {
    source: string;
    page_idx?: number;
    block_id?: string;
    structure_role?: string;
    layout_role?: string;
};
export type DocumentTitleCandidate = {
    value: string;
    source: string;
    confidence: number;
    evidence: DocumentMetadataEvidence[];
};
export type DocumentMetadataSuggestion = {
    suggestion_id: string;
    document_id: string;
    source_job_id?: string;
    artifact_sha256: string;
    status: "completed" | "applied" | string;
    fields: string[];
    title_candidates: DocumentTitleCandidate[];
    selected_title: string;
    generation_method: string;
    needs_ai_review: boolean;
    applied: boolean;
    can_apply: boolean;
    created_at: string;
    updated_at: string;
};
export type CreateDocumentMetadataSuggestionInput = {
    job_id?: string;
    fields?: Array<"title">;
    apply_if_default?: boolean;
};
export type ApplyDocumentMetadataSuggestionInput = {
    expected_document_updated_at?: string;
};
export type DocumentListQuery = {
    limit?: number;
    offset?: number;
    readingStatus?: string;
    tag?: string;
    collectionId?: string;
};
export type DocumentListView = {
    documents: DocumentRecord[];
    /** Total matches for the current filters; unaffected by limit/offset. */
    total: number;
    limit: number;
    offset: number;
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
export declare function fetchDocumentList(apiPrefix: string, { limit, offset, readingStatus, tag, collectionId }?: DocumentListQuery): Promise<DocumentListView>;
export declare function fetchDocumentByJobId(apiPrefix: string, jobId: string): Promise<DocumentRecord | null>;
export declare function fetchDocument(apiPrefix: string, documentId: string): Promise<DocumentRecord>;
export declare function patchDocument(apiPrefix: string, documentId: string, payload?: Record<string, unknown>): Promise<DocumentRecord>;
export declare function createDocumentMetadataSuggestion(apiPrefix: string, documentId: string, payload?: CreateDocumentMetadataSuggestionInput): Promise<DocumentMetadataSuggestion>;
export declare function fetchDocumentMetadataSuggestions(apiPrefix: string, documentId: string, { limit }?: {
    limit?: number;
}): Promise<DocumentMetadataSuggestion[]>;
export declare function applyDocumentMetadataSuggestion(apiPrefix: string, documentId: string, suggestionId: string, payload?: ApplyDocumentMetadataSuggestionInput): Promise<{
    suggestion: DocumentMetadataSuggestion;
    document: DocumentRecord;
}>;
export declare function deleteDocument(apiPrefix: string, documentId: string, { force }?: {
    force?: boolean;
}): Promise<any>;
export declare function translateDocument(apiPrefix: string, documentId: string, payload?: Record<string, unknown>): Promise<DocumentJobSubmissionView>;
export declare function ocrDocument(apiPrefix: string, documentId: string, payload?: Record<string, unknown>): Promise<any>;
export declare function submitDocument(apiPrefix: string, documentId: string, payload?: Record<string, unknown>): Promise<DocumentJobSubmissionView>;
export declare function fetchDocumentJobs(apiPrefix: string, documentId: string, { limit, offset }?: DocumentJobsQuery): Promise<DocumentJobsView>;
