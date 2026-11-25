// documents — pure
import { refusedSubmissionError } from "./http.js";
import * as generated from "./generated/library-documents.js";
import { failWith, failWithServerMessage } from "./request.js";
import { newIdempotencyKey } from "./idempotency.js";
function documentRequestError(fallback, status, payload) {
    // 通用错误把结构化数据放在 payload.error.details；老接口可能直接在 payload.details/data。
    const structured = payload?.error && typeof payload.error === "object" ? payload.error : null;
    const details = structured?.details && typeof structured.details === "object"
        ? structured.details
        : payload?.details && typeof payload.details === "object"
            ? payload.details
            : payload?.data && typeof payload.data === "object"
                ? payload.data
                : {};
    const message = `${payload?.message || details?.message || fallback}`;
    const error = new Error(`${message}(${status})`);
    error.status = status;
    const errorCode = `${payload?.error_code || structured?.code || details?.error_code || details?.code || (typeof payload?.code === "string" ? payload.code : "")}`.trim();
    if (errorCode)
        error.errorCode = errorCode;
    const reason = `${payload?.reason || details?.reason || ""}`.trim();
    if (reason)
        error.reason = reason;
    const canFallback = payload?.can_fallback_to_ocr ?? details?.can_fallback_to_ocr;
    if (typeof canFallback === "boolean")
        error.canFallbackToOcr = canFallback;
    return error;
}
// 下面这些走生成的请求函数（契约 library-documents.v1 的端点表），这里只管参数整理和给用户看的报错。
function trimmed(value) {
    const text = `${value ?? ""}`.trim();
    return text || undefined;
}
function requireId(value, name) {
    const normalized = `${value || ""}`.trim();
    if (!normalized)
        throw new Error(`缺少 ${name}。`);
    return normalized;
}
function documentError(fallback) {
    return (status, payload) => documentRequestError(fallback, status, payload);
}
export async function fetchDocumentList(apiPrefix, { limit = 50, offset = 0, readingStatus = "", collectionId = "", q = "" } = {}) {
    return generated.listDocuments(apiPrefix, { query: { limit, offset, reading_status: trimmed(readingStatus), collection_id: trimmed(collectionId), q: trimmed(q) } }, { onError: failWith("读取文档库失败，请稍后重试。") });
}
export async function fetchDocumentByJobId(apiPrefix, jobId) {
    const normalized = trimmed(jobId);
    if (!normalized)
        return null;
    const payload = await generated.listDocuments(apiPrefix, { query: { job_id: normalized } }, { onError: failWith("按 job 查文档失败，请稍后重试。") });
    const documents = payload?.documents;
    return Array.isArray(documents) && documents.length ? documents[0] : null;
}
export async function fetchDocument(apiPrefix, documentId) {
    return generated.getDocument(apiPrefix, { document_id: requireId(documentId, "document_id") }, { onError: failWith("读取文档详情失败，请稍后重试。") });
}
export async function patchDocument(apiPrefix, documentId, payload = {}) {
    return generated.patchDocument(apiPrefix, { document_id: requireId(documentId, "document_id"), body: payload }, { onError: failWithServerMessage("更新文档失败，请稍后重试。") });
}
/** GET /documents/:id/reading —— 阅读器该打开哪个任务。给了 version 就是那个译文版本的（阅读页「对比版本」用）。 */
export async function fetchDocumentReading(apiPrefix, documentId, { version = "" } = {}) {
    return generated.getDocumentReading(apiPrefix, { document_id: requireId(documentId, "document_id"), query: version ? { version } : {} }, { onError: failWith("读取阅读入口失败。") });
}
/** GET /documents/:id/translation-versions —— 一本书的几份译文和当前选的哪份（null = 自动，逐页取最新）。 */
export async function fetchTranslationVersions(apiPrefix, documentId, { includeHidden = false } = {}) {
    return generated.listTranslationVersions(apiPrefix, { document_id: requireId(documentId, "document_id"), query: includeHidden ? { include_hidden: true } : {} }, { onError: failWith("读取译文版本失败。") });
}
/** PUT /documents/:id/translation-version —— 换当前版本；null 回到自动。隐藏的版本 409，带后端的原因。 */
export async function setCurrentTranslationVersion(apiPrefix, documentId, versionId) {
    return generated.setCurrentTranslationVersion(apiPrefix, { document_id: requireId(documentId, "document_id"), body: { version_id: versionId } }, { onError: failWithServerMessage("切换译文版本失败，请稍后重试。") });
}
/** PATCH /documents/:id/translation-versions/:version_id —— 改名（空串清掉）、隐藏或恢复。 */
export async function patchTranslationVersion(apiPrefix, documentId, versionId, payload) {
    return generated.patchTranslationVersion(apiPrefix, { document_id: requireId(documentId, "document_id"), version_id: requireId(versionId, "version_id"), body: payload }, { onError: failWithServerMessage("修改译文版本失败，请稍后重试。") });
}
/** GET /documents/:id/translation-coverage —— 一本书翻了哪些页、每次任务提供了几页。 */
export async function fetchDocumentTranslationCoverage(apiPrefix, documentId) {
    return generated.getTranslationCoverage(apiPrefix, { document_id: requireId(documentId, "document_id") }, { onError: failWith("读取翻译覆盖失败。") });
}
export async function createDocumentMetadataSuggestion(apiPrefix, documentId, payload = {}) {
    return generated.createMetadataSuggestion(apiPrefix, { document_id: requireId(documentId, "document_id"), body: payload }, { onError: documentError("生成文档元数据建议失败。") });
}
export async function fetchDocumentMetadataSuggestions(apiPrefix, documentId, { limit = 20 } = {}) {
    const normalized = trimmed(documentId);
    if (!normalized)
        return [];
    const payload = await generated.listMetadataSuggestions(apiPrefix, { document_id: normalized, query: { limit } }, { onError: documentError("读取文档元数据建议失败。") });
    return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
}
export async function applyDocumentMetadataSuggestion(apiPrefix, documentId, suggestionId, payload = {}) {
    const document_id = requireId(documentId, "document_id");
    const suggestion_id = requireId(suggestionId, "suggestion_id");
    return generated.applyMetadataSuggestion(apiPrefix, { document_id, suggestion_id, body: payload }, { onError: documentError("应用文档元数据建议失败。") });
}
export async function deleteDocument(apiPrefix, documentId, { force = false } = {}) {
    // 保留 HTTP 状态：409 是文档下还有排队或运行中的任务（force=true 才删）
    return generated.deleteDocument(apiPrefix, { document_id: requireId(documentId, "document_id"), query: { force: force || undefined } }, { onError: documentError("删除文档失败，请稍后重试。") });
}
export async function translateDocument(apiPrefix, documentId, payload = {}) {
    // 页数额度不够、磁盘空间不够给一句中文（refusedSubmissionError）；复用 OCR 出错时的 reason、can_fallback_to_ocr 由 documentRequestError 挂上。
    return generated.translateDocument(apiPrefix, { document_id: requireId(documentId, "document_id"), body: payload }, { idempotencyKey: newIdempotencyKey(), onError: (status, envelope) => refusedSubmissionError(status, envelope) ?? documentRequestError("发起翻译失败，请稍后重试。", status, envelope) });
}
export async function ocrDocument(apiPrefix, documentId, payload = {}) {
    return generated.ocrDocument(apiPrefix, { document_id: requireId(documentId, "document_id"), body: payload }, { idempotencyKey: newIdempotencyKey(), onError: (status, envelope) => refusedSubmissionError(status, envelope) ?? failWithServerMessage("发起 OCR 失败，请稍后重试。")(status, envelope) });
}
export async function submitDocument(apiPrefix, documentId, payload = {}) {
    const workflow = `${payload?.workflow || ""}`.trim().toLowerCase();
    if (workflow === "ocr") {
        return ocrDocument(apiPrefix, documentId, payload);
    }
    return translateDocument(apiPrefix, documentId, payload);
}
export async function fetchDocumentJobs(apiPrefix, documentId, { limit = 50, offset = 0 } = {}) {
    const normalized = trimmed(documentId);
    if (!normalized)
        return { items: [] };
    const payload = await generated.listDocumentJobs(apiPrefix, { document_id: normalized, query: { limit, offset } }, { onError: failWith("读取文档任务失败，请稍后重试。") });
    return {
        ...payload,
        items: Array.isArray(payload?.items) ? payload.items : [],
    };
}
