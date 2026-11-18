import type { AddCollectionDocumentsInput, ApplyDocumentMetadataSuggestionInput, CollectionDeleteResultView, CollectionDocumentRemoveResultView, CollectionListView, CollectionRecord, CreateCollectionInput, CreateDocumentMetadataSuggestionInput, CreateJobInput, DeleteDocumentQuery, DocumentDeleteResultView, DocumentFilesView, DocumentJobListView, DocumentListView, DocumentMetadataSuggestionApplyView, DocumentMetadataSuggestionListView, DocumentMetadataSuggestionView, DocumentReadingQuery, DocumentReadingView, DocumentRecord, JobSubmissionView, ListDocumentJobsQuery, ListDocumentMetadataSuggestionsQuery, ListDocumentsQuery, PatchCollectionInput, PatchDocumentInput, PatchTranslationVersionInput, SearchQuery, SearchResultView, SetCurrentTranslationVersionInput, TranslationCoverageView, TranslationVersionsQuery, TranslationVersionsView } from "@retainpdf/contracts/library-documents";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/documents */
export declare function listDocuments(apiPrefix: string | undefined, args?: {
    query?: ListDocumentsQuery;
}, options?: RequestOptions): Promise<DocumentListView>;
/** GET /api/v1/documents/:document_id */
export declare function getDocument(apiPrefix: string | undefined, args: {
    document_id: string;
}, options?: RequestOptions): Promise<DocumentRecord>;
/** PATCH /api/v1/documents/:document_id */
export declare function patchDocument(apiPrefix: string | undefined, args: {
    document_id: string;
    body: PatchDocumentInput;
}, options?: RequestOptions): Promise<DocumentRecord>;
/** DELETE /api/v1/documents/:document_id */
export declare function deleteDocument(apiPrefix: string | undefined, args: {
    document_id: string;
    query?: DeleteDocumentQuery;
}, options?: RequestOptions): Promise<DocumentDeleteResultView>;
/** GET /api/v1/documents/:document_id/reading */
export declare function getDocumentReading(apiPrefix: string | undefined, args: {
    document_id: string;
    query?: DocumentReadingQuery;
}, options?: RequestOptions): Promise<DocumentReadingView>;
/** GET /api/v1/documents/:document_id/translation-coverage */
export declare function getTranslationCoverage(apiPrefix: string | undefined, args: {
    document_id: string;
}, options?: RequestOptions): Promise<TranslationCoverageView>;
/** GET /api/v1/documents/:document_id/files */
export declare function listDocumentFiles(apiPrefix: string | undefined, args: {
    document_id: string;
}, options?: RequestOptions): Promise<DocumentFilesView>;
/** GET /api/v1/documents/:document_id/metadata-suggestions */
export declare function listMetadataSuggestions(apiPrefix: string | undefined, args: {
    document_id: string;
    query?: ListDocumentMetadataSuggestionsQuery;
}, options?: RequestOptions): Promise<DocumentMetadataSuggestionListView>;
/** POST /api/v1/documents/:document_id/metadata-suggestions */
export declare function createMetadataSuggestion(apiPrefix: string | undefined, args: {
    document_id: string;
    body: CreateDocumentMetadataSuggestionInput;
}, options?: RequestOptions): Promise<DocumentMetadataSuggestionView>;
/** POST /api/v1/documents/:document_id/metadata-suggestions/:suggestion_id/apply */
export declare function applyMetadataSuggestion(apiPrefix: string | undefined, args: {
    document_id: string;
    suggestion_id: string;
    body: ApplyDocumentMetadataSuggestionInput;
}, options?: RequestOptions): Promise<DocumentMetadataSuggestionApplyView>;
/** GET /api/v1/search */
export declare function searchLibrary(apiPrefix: string | undefined, args?: {
    query?: SearchQuery;
}, options?: RequestOptions): Promise<SearchResultView>;
/** GET /api/v1/collections */
export declare function listCollections(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<CollectionListView>;
/** POST /api/v1/collections */
export declare function createCollection(apiPrefix: string | undefined, args: {
    body: CreateCollectionInput;
}, options?: RequestOptions): Promise<CollectionRecord>;
/** PATCH /api/v1/collections/:collection_id */
export declare function patchCollection(apiPrefix: string | undefined, args: {
    collection_id: string;
    body: PatchCollectionInput;
}, options?: RequestOptions): Promise<CollectionRecord>;
/** DELETE /api/v1/collections/:collection_id */
export declare function deleteCollection(apiPrefix: string | undefined, args: {
    collection_id: string;
}, options?: RequestOptions): Promise<CollectionDeleteResultView>;
/** POST /api/v1/collections/:collection_id/documents */
export declare function addCollectionDocuments(apiPrefix: string | undefined, args: {
    collection_id: string;
    body: AddCollectionDocumentsInput;
}, options?: RequestOptions): Promise<CollectionRecord>;
/** DELETE /api/v1/collections/:collection_id/documents/:document_id */
export declare function removeCollectionDocument(apiPrefix: string | undefined, args: {
    collection_id: string;
    document_id: string;
}, options?: RequestOptions): Promise<CollectionDocumentRemoveResultView>;
/** GET /api/v1/documents/:document_id/jobs */
export declare function listDocumentJobs(apiPrefix: string | undefined, args: {
    document_id: string;
    query?: ListDocumentJobsQuery;
}, options?: RequestOptions): Promise<DocumentJobListView>;
/** POST /api/v1/documents/:document_id/translate */
export declare function translateDocument(apiPrefix: string | undefined, args: {
    document_id: string;
    body: CreateJobInput;
}, options?: RequestOptions): Promise<JobSubmissionView>;
/** POST /api/v1/documents/:document_id/ocr */
export declare function ocrDocument(apiPrefix: string | undefined, args: {
    document_id: string;
    body: CreateJobInput;
}, options?: RequestOptions): Promise<JobSubmissionView>;
/** GET /api/v1/documents/:document_id/translation-versions */
export declare function listTranslationVersions(apiPrefix: string | undefined, args: {
    document_id: string;
    query?: TranslationVersionsQuery;
}, options?: RequestOptions): Promise<TranslationVersionsView>;
/** PUT /api/v1/documents/:document_id/translation-version */
export declare function setCurrentTranslationVersion(apiPrefix: string | undefined, args: {
    document_id: string;
    body: SetCurrentTranslationVersionInput;
}, options?: RequestOptions): Promise<TranslationVersionsView>;
/** PATCH /api/v1/documents/:document_id/translation-versions/:version_id */
export declare function patchTranslationVersion(apiPrefix: string | undefined, args: {
    document_id: string;
    version_id: string;
    body: PatchTranslationVersionInput;
}, options?: RequestOptions): Promise<TranslationVersionsView>;
