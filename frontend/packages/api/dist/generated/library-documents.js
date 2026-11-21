// 生成文件，不要手改。来源：contracts/library-documents.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** GET /api/v1/documents */
export function listDocuments(apiPrefix, args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `documents`, query: args.query, options });
}
/** GET /api/v1/documents/:document_id */
export function getDocument(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}`, options });
}
/** PATCH /api/v1/documents/:document_id */
export function patchDocument(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PATCH", path: `documents/${encodePathParam(args.document_id)}`, body: args.body, options });
}
/** DELETE /api/v1/documents/:document_id */
export function deleteDocument(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `documents/${encodePathParam(args.document_id)}`, query: args.query, options });
}
/** GET /api/v1/documents/:document_id/reading */
export function getDocumentReading(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/reading`, query: args.query, options });
}
/** GET /api/v1/documents/:document_id/translation-coverage */
export function getTranslationCoverage(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/translation-coverage`, options });
}
/** GET /api/v1/documents/:document_id/files */
export function listDocumentFiles(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/files`, options });
}
/** GET /api/v1/documents/:document_id/metadata-suggestions */
export function listMetadataSuggestions(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/metadata-suggestions`, query: args.query, options });
}
/** POST /api/v1/documents/:document_id/metadata-suggestions */
export function createMetadataSuggestion(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/metadata-suggestions`, body: args.body, options });
}
/** POST /api/v1/documents/:document_id/metadata-suggestions/:suggestion_id/apply */
export function applyMetadataSuggestion(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/metadata-suggestions/${encodePathParam(args.suggestion_id)}/apply`, body: args.body, options });
}
/** GET /api/v1/search */
export function searchLibrary(apiPrefix, args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `search`, query: args.query, options });
}
/** GET /api/v1/collections */
export function listCollections(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `collections`, options });
}
/** POST /api/v1/collections */
export function createCollection(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `collections`, body: args.body, options });
}
/** PATCH /api/v1/collections/:collection_id */
export function patchCollection(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PATCH", path: `collections/${encodePathParam(args.collection_id)}`, body: args.body, options });
}
/** DELETE /api/v1/collections/:collection_id */
export function deleteCollection(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `collections/${encodePathParam(args.collection_id)}`, options });
}
/** POST /api/v1/collections/:collection_id/documents */
export function addCollectionDocuments(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `collections/${encodePathParam(args.collection_id)}/documents`, body: args.body, options });
}
/** DELETE /api/v1/collections/:collection_id/documents/:document_id */
export function removeCollectionDocument(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `collections/${encodePathParam(args.collection_id)}/documents/${encodePathParam(args.document_id)}`, options });
}
/** GET /api/v1/documents/:document_id/jobs */
export function listDocumentJobs(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/jobs`, query: args.query, options });
}
/** POST /api/v1/documents/:document_id/translate */
export function translateDocument(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/translate`, body: args.body, options });
}
/** POST /api/v1/documents/:document_id/ocr */
export function ocrDocument(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `documents/${encodePathParam(args.document_id)}/ocr`, body: args.body, options });
}
/** GET /api/v1/documents/:document_id/translation-versions */
export function listTranslationVersions(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/translation-versions`, query: args.query, options });
}
/** PUT /api/v1/documents/:document_id/translation-version */
export function setCurrentTranslationVersion(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PUT", path: `documents/${encodePathParam(args.document_id)}/translation-version`, body: args.body, options });
}
/** PATCH /api/v1/documents/:document_id/translation-versions/:version_id */
export function patchTranslationVersion(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PATCH", path: `documents/${encodePathParam(args.document_id)}/translation-versions/${encodePathParam(args.version_id)}`, body: args.body, options });
}
/** GET /api/v1/tags */
export function listTags(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `tags`, options });
}
/** POST /api/v1/tags */
export function createTag(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `tags`, body: args.body, options });
}
/** PATCH /api/v1/tags/:tag_id */
export function patchTag(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PATCH", path: `tags/${encodePathParam(args.tag_id)}`, body: args.body, options });
}
/** DELETE /api/v1/tags/:tag_id */
export function deleteTag(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `tags/${encodePathParam(args.tag_id)}`, options });
}
/** PUT /api/v1/documents/:document_id/tags */
export function setDocumentTags(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PUT", path: `documents/${encodePathParam(args.document_id)}/tags`, body: args.body, options });
}
