// documents — pure
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
function documentRequestError(fallback, status, payload) {
    const details = payload?.details && typeof payload.details === "object"
        ? payload.details
        : payload?.data && typeof payload.data === "object"
            ? payload.data
            : {};
    const message = `${payload?.message || details?.message || fallback}`;
    const error = new Error(`${message}(${status})`);
    error.status = status;
    const errorCode = `${payload?.error_code || details?.error_code || details?.code || (typeof payload?.code === "string" ? payload.code : "")}`.trim();
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
export async function fetchDocumentList(apiPrefix, { limit = 50, offset = 0, readingStatus = "", tag = "", collectionId = "" } = {}) {
    const params = new URLSearchParams();
    params.set("limit", `${limit}`);
    params.set("offset", `${offset}`);
    if (`${readingStatus || ""}`.trim())
        params.set("reading_status", `${readingStatus}`.trim());
    if (`${tag || ""}`.trim())
        params.set("tag", `${tag}`.trim());
    if (`${collectionId || ""}`.trim())
        params.set("collection_id", `${collectionId}`.trim());
    const resp = await fetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取文档库失败，请稍后重试。(${resp.status})`);
    return unwrapEnvelope(await resp.json());
}
export async function fetchDocumentByJobId(apiPrefix, jobId) {
    const normalized = `${jobId || ""}`.trim();
    if (!normalized)
        return null;
    const params = new URLSearchParams();
    params.set("job_id", normalized);
    const resp = await fetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`按 job 查文档失败，请稍后重试。(${resp.status})`);
    const payload = unwrapEnvelope(await resp.json()) || { documents: [], total: 0, limit: 0, offset: 0 };
    const { documents = [] } = payload;
    return Array.isArray(documents) && documents.length ? documents[0] : null;
}
export async function fetchDocument(apiPrefix, documentId) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取文档详情失败，请稍后重试。(${resp.status})`);
    return unwrapEnvelope(await resp.json());
}
export async function patchDocument(apiPrefix, documentId, payload = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), {
        method: "PATCH",
        headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        throw new Error(`${envelope?.message || "更新文档失败，请稍后重试。"}(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function createDocumentMetadataSuggestion(apiPrefix, documentId, payload = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/metadata-suggestions`), {
        method: "POST",
        headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        throw documentRequestError("生成文档元数据建议失败。", resp.status, envelope);
    }
    return unwrapEnvelope(await resp.json());
}
export async function fetchDocumentMetadataSuggestions(apiPrefix, documentId, { limit = 20 } = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        return [];
    const params = new URLSearchParams({ limit: `${limit}` });
    const resp = await fetch(`${buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/metadata-suggestions`)}?${params.toString()}`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        throw documentRequestError("读取文档元数据建议失败。", resp.status, envelope);
    }
    const payload = unwrapEnvelope(await resp.json());
    return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
}
export async function applyDocumentMetadataSuggestion(apiPrefix, documentId, suggestionId, payload = {}) {
    const normalizedDocumentId = `${documentId || ""}`.trim();
    const normalizedSuggestionId = `${suggestionId || ""}`.trim();
    if (!normalizedDocumentId)
        throw new Error("缺少 document_id。");
    if (!normalizedSuggestionId)
        throw new Error("缺少 suggestion_id。");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalizedDocumentId)}/metadata-suggestions/${encodeURIComponent(normalizedSuggestionId)}/apply`), {
        method: "POST",
        headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        throw documentRequestError("应用文档元数据建议失败。", resp.status, envelope);
    }
    return unwrapEnvelope(await resp.json());
}
export async function deleteDocument(apiPrefix, documentId, { force = false } = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const params = force ? "?force=true" : "";
    const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`) + params, { method: "DELETE", headers: buildApiHeaders() });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        const error = new Error(`${envelope?.message || "删除文档失败，请稍后重试。"}(${resp.status})`);
        error.status = resp.status;
        throw error;
    }
    return unwrapEnvelope(await resp.json());
}
export async function translateDocument(apiPrefix, documentId, payload = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/translate`), {
        method: "POST",
        headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        throw documentRequestError("发起翻译失败，请稍后重试。", resp.status, envelope);
    }
    return unwrapEnvelope(await resp.json());
}
export async function ocrDocument(apiPrefix, documentId, payload = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/ocr`), {
        method: "POST",
        headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        throw new Error(`${envelope?.message || "发起 OCR 失败，请稍后重试。"}(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function submitDocument(apiPrefix, documentId, payload = {}) {
    const workflow = `${payload?.workflow || ""}`.trim().toLowerCase();
    if (workflow === "ocr") {
        return ocrDocument(apiPrefix, documentId, payload);
    }
    return translateDocument(apiPrefix, documentId, payload);
}
export async function fetchDocumentJobs(apiPrefix, documentId, { limit = 50, offset = 0 } = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        return { items: [] };
    const params = new URLSearchParams();
    params.set("limit", `${limit}`);
    params.set("offset", `${offset}`);
    const resp = await fetch(`${buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/jobs`)}?${params.toString()}`, { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取文档任务失败，请稍后重试。(${resp.status})`);
    const payload = unwrapEnvelope(await resp.json());
    return {
        ...payload,
        items: Array.isArray(payload?.items) ? payload.items : [],
    };
}
