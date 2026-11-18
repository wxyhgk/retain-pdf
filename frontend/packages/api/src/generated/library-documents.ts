// 生成文件，不要手改。来源：contracts/library-documents.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  AddCollectionDocumentsInput,
  ApplyDocumentMetadataSuggestionInput,
  CollectionDeleteResultView,
  CollectionDocumentRemoveResultView,
  CollectionListView,
  CollectionRecord,
  CreateCollectionInput,
  CreateDocumentMetadataSuggestionInput,
  CreateJobInput,
  DeleteDocumentQuery,
  DocumentDeleteResultView,
  DocumentFilesView,
  DocumentJobListView,
  DocumentListView,
  DocumentMetadataSuggestionApplyView,
  DocumentMetadataSuggestionListView,
  DocumentMetadataSuggestionView,
  DocumentReadingQuery,
  DocumentReadingView,
  DocumentRecord,
  JobSubmissionView,
  ListDocumentJobsQuery,
  ListDocumentMetadataSuggestionsQuery,
  ListDocumentsQuery,
  PatchCollectionInput,
  PatchDocumentInput,
  PatchTranslationVersionInput,
  SearchQuery,
  SearchResultView,
  SetCurrentTranslationVersionInput,
  TranslationCoverageView,
  TranslationVersionsQuery,
  TranslationVersionsView,
} from "@retainpdf/contracts/library-documents";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/documents */
export function listDocuments(
  apiPrefix: string | undefined,
  args: { query?: ListDocumentsQuery } = {},
  options?: RequestOptions,
): Promise<DocumentListView> {
  return request<DocumentListView>({ apiPrefix, method: "GET", path: `documents`, query: args.query, options });
}

/** GET /api/v1/documents/:document_id */
export function getDocument(
  apiPrefix: string | undefined,
  args: { document_id: string },
  options?: RequestOptions,
): Promise<DocumentRecord> {
  return request<DocumentRecord>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}`, options });
}

/** PATCH /api/v1/documents/:document_id */
export function patchDocument(
  apiPrefix: string | undefined,
  args: { document_id: string; body: PatchDocumentInput },
  options?: RequestOptions,
): Promise<DocumentRecord> {
  return request<DocumentRecord>({ apiPrefix, method: "PATCH", path: `documents/${encodePathParam(args.document_id)}`, body: args.body, options });
}

/** DELETE /api/v1/documents/:document_id */
export function deleteDocument(
  apiPrefix: string | undefined,
  args: { document_id: string; query?: DeleteDocumentQuery },
  options?: RequestOptions,
): Promise<DocumentDeleteResultView> {
  return request<DocumentDeleteResultView>({ apiPrefix, method: "DELETE", path: `documents/${encodePathParam(args.document_id)}`, query: args.query, options });
}

/** GET /api/v1/documents/:document_id/reading */
export function getDocumentReading(
  apiPrefix: string | undefined,
  args: { document_id: string; query?: DocumentReadingQuery },
  options?: RequestOptions,
): Promise<DocumentReadingView> {
  return request<DocumentReadingView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/reading`, query: args.query, options });
}

/** GET /api/v1/documents/:document_id/translation-coverage */
export function getTranslationCoverage(
  apiPrefix: string | undefined,
  args: { document_id: string },
  options?: RequestOptions,
): Promise<TranslationCoverageView> {
  return request<TranslationCoverageView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/translation-coverage`, options });
}

/** GET /api/v1/documents/:document_id/files */
export function listDocumentFiles(
  apiPrefix: string | undefined,
  args: { document_id: string },
  options?: RequestOptions,
): Promise<DocumentFilesView> {
  return request<DocumentFilesView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/files`, options });
}

/** GET /api/v1/documents/:document_id/metadata-suggestions */
export function listMetadataSuggestions(
  apiPrefix: string | undefined,
  args: { document_id: string; query?: ListDocumentMetadataSuggestionsQuery },
  options?: RequestOptions,
): Promise<DocumentMetadataSuggestionListView> {
  return request<DocumentMetadataSuggestionListView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/metadata-suggestions`, query: args.query, options });
}

/** POST /api/v1/documents/:document_id/metadata-suggestions */
export function createMetadataSuggestion(
  apiPrefix: string | undefined,
  args: { document_id: string; body: CreateDocumentMetadataSuggestionInput },
  options?: RequestOptions,
): Promise<DocumentMetadataSuggestionView> {
  return request<DocumentMetadataSuggestionView>({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/metadata-suggestions`, body: args.body, options });
}

/** POST /api/v1/documents/:document_id/metadata-suggestions/:suggestion_id/apply */
export function applyMetadataSuggestion(
  apiPrefix: string | undefined,
  args: { document_id: string; suggestion_id: string; body: ApplyDocumentMetadataSuggestionInput },
  options?: RequestOptions,
): Promise<DocumentMetadataSuggestionApplyView> {
  return request<DocumentMetadataSuggestionApplyView>({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/metadata-suggestions/${encodePathParam(args.suggestion_id)}/apply`, body: args.body, options });
}

/** GET /api/v1/search */
export function searchLibrary(
  apiPrefix: string | undefined,
  args: { query?: SearchQuery } = {},
  options?: RequestOptions,
): Promise<SearchResultView> {
  return request<SearchResultView>({ apiPrefix, method: "GET", path: `search`, query: args.query, options });
}

/** GET /api/v1/collections */
export function listCollections(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<CollectionListView> {
  return request<CollectionListView>({ apiPrefix, method: "GET", path: `collections`, options });
}

/** POST /api/v1/collections */
export function createCollection(
  apiPrefix: string | undefined,
  args: { body: CreateCollectionInput },
  options?: RequestOptions,
): Promise<CollectionRecord> {
  return request<CollectionRecord>({ apiPrefix, method: "POST", path: `collections`, body: args.body, options });
}

/** PATCH /api/v1/collections/:collection_id */
export function patchCollection(
  apiPrefix: string | undefined,
  args: { collection_id: string; body: PatchCollectionInput },
  options?: RequestOptions,
): Promise<CollectionRecord> {
  return request<CollectionRecord>({ apiPrefix, method: "PATCH", path: `collections/${encodePathParam(args.collection_id)}`, body: args.body, options });
}

/** DELETE /api/v1/collections/:collection_id */
export function deleteCollection(
  apiPrefix: string | undefined,
  args: { collection_id: string },
  options?: RequestOptions,
): Promise<CollectionDeleteResultView> {
  return request<CollectionDeleteResultView>({ apiPrefix, method: "DELETE", path: `collections/${encodePathParam(args.collection_id)}`, options });
}

/** POST /api/v1/collections/:collection_id/documents */
export function addCollectionDocuments(
  apiPrefix: string | undefined,
  args: { collection_id: string; body: AddCollectionDocumentsInput },
  options?: RequestOptions,
): Promise<CollectionRecord> {
  return request<CollectionRecord>({ apiPrefix, method: "POST", path: `collections/${encodePathParam(args.collection_id)}/documents`, body: args.body, options });
}

/** DELETE /api/v1/collections/:collection_id/documents/:document_id */
export function removeCollectionDocument(
  apiPrefix: string | undefined,
  args: { collection_id: string; document_id: string },
  options?: RequestOptions,
): Promise<CollectionDocumentRemoveResultView> {
  return request<CollectionDocumentRemoveResultView>({ apiPrefix, method: "DELETE", path: `collections/${encodePathParam(args.collection_id)}/documents/${encodePathParam(args.document_id)}`, options });
}

/** GET /api/v1/documents/:document_id/jobs */
export function listDocumentJobs(
  apiPrefix: string | undefined,
  args: { document_id: string; query?: ListDocumentJobsQuery },
  options?: RequestOptions,
): Promise<DocumentJobListView> {
  return request<DocumentJobListView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/jobs`, query: args.query, options });
}

/** POST /api/v1/documents/:document_id/translate */
export function translateDocument(
  apiPrefix: string | undefined,
  args: { document_id: string; body: CreateJobInput },
  options?: RequestOptions,
): Promise<JobSubmissionView> {
  return request<JobSubmissionView>({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/translate`, body: args.body, options });
}

/** POST /api/v1/documents/:document_id/ocr */
export function ocrDocument(
  apiPrefix: string | undefined,
  args: { document_id: string; body: CreateJobInput },
  options?: RequestOptions,
): Promise<JobSubmissionView> {
  return request<JobSubmissionView>({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/ocr`, body: args.body, options });
}

/** GET /api/v1/documents/:document_id/translation-versions */
export function listTranslationVersions(
  apiPrefix: string | undefined,
  args: { document_id: string; query?: TranslationVersionsQuery },
  options?: RequestOptions,
): Promise<TranslationVersionsView> {
  return request<TranslationVersionsView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/translation-versions`, query: args.query, options });
}

/** PUT /api/v1/documents/:document_id/translation-version */
export function setCurrentTranslationVersion(
  apiPrefix: string | undefined,
  args: { document_id: string; body: SetCurrentTranslationVersionInput },
  options?: RequestOptions,
): Promise<TranslationVersionsView> {
  return request<TranslationVersionsView>({ apiPrefix, method: "PUT", path: `documents/${encodePathParam(args.document_id)}/translation-version`, body: args.body, options });
}

/** PATCH /api/v1/documents/:document_id/translation-versions/:version_id */
export function patchTranslationVersion(
  apiPrefix: string | undefined,
  args: { document_id: string; version_id: string; body: PatchTranslationVersionInput },
  options?: RequestOptions,
): Promise<TranslationVersionsView> {
  return request<TranslationVersionsView>({ apiPrefix, method: "PATCH", path: `documents/${encodePathParam(args.document_id)}/translation-versions/${encodePathParam(args.version_id)}`, body: args.body, options });
}
