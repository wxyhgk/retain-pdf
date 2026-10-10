// documents — pure
import { apiFetch } from "./internal/runtime.js";
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint, pageQuotaErrorFromPayload } from "./http.js";
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
    const favoriteCount = Number(details?.favorite_count);
    if (Number.isFinite(favoriteCount) && favoriteCount > 0) {
        error.favoriteCount = favoriteCount;
    }
    const clearPath = `${details?.clear_favorites_path || ""}`.trim();
    if (clearPath)
        error.clearFavoritesPath = clearPath;
    const scope = `${details?.scope || ""}`.trim();
    if (scope === "document" || scope === "job")
        error.favoriteScope = scope;
    return error;
}
export async function fetchDocumentList(apiPrefix, { limit = 50, offset = 0, readingStatus = "", tag = "", collectionId = "", q = "" } = {}) {
    const params = new URLSearchParams();
    params.set("limit", `${limit}`);
    params.set("offset", `${offset}`);
    if (`${readingStatus || ""}`.trim())
        params.set("reading_status", `${readingStatus}`.trim());
    if (`${tag || ""}`.trim())
        params.set("tag", `${tag}`.trim());
    if (`${collectionId || ""}`.trim())
        params.set("collection_id", `${collectionId}`.trim());
    if (`${q || ""}`.trim())
        params.set("q", `${q}`.trim());
    const resp = await apiFetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, { headers: buildApiHeaders() });
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
    const resp = await apiFetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, { headers: buildApiHeaders() });
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
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取文档详情失败，请稍后重试。(${resp.status})`);
    return unwrapEnvelope(await resp.json());
}
export async function patchDocument(apiPrefix, documentId, payload = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), {
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
export async function fetchDocumentReading(apiPrefix, documentId) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/reading`), {
        headers: buildApiHeaders(),
    });
    if (!resp.ok)
        throw new Error(`读取阅读入口失败。(${resp.status})`);
    return unwrapEnvelope(await resp.json());
}
export async function fetchDocumentTranslationCoverage(apiPrefix, documentId) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/translation-coverage`), {
        headers: buildApiHeaders(),
    });
    if (!resp.ok)
        throw new Error(`读取翻译覆盖失败。(${resp.status})`);
    return unwrapEnvelope(await resp.json());
}
export async function createDocumentMetadataSuggestion(apiPrefix, documentId, payload = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/metadata-suggestions`), {
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
    const resp = await apiFetch(`${buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/metadata-suggestions`)}?${params.toString()}`, { headers: buildApiHeaders() });
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
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalizedDocumentId)}/metadata-suggestions/${encodeURIComponent(normalizedSuggestionId)}/apply`), {
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
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`) + params, { method: "DELETE", headers: buildApiHeaders() });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        // 保留结构化 error.code / error.details（收藏保护 409 靠它拿条数和清空路径）
        throw documentRequestError("删除文档失败，请稍后重试。", resp.status, envelope);
    }
    return unwrapEnvelope(await resp.json());
}
/**
 * DELETE `clear_favorites_path`（后端在 DELETE_BLOCKED_BY_FAVORITES 的
 * error.details 里给好的路径，文档级/run 级共用）。幂等：没有收藏返回 0；
 * 目标不存在是 404。返回实际删除的收藏条数。
 */
export async function clearFavorites(apiPrefix, clearFavoritesPath) {
    const raw = `${clearFavoritesPath || ""}`.trim();
    if (!raw)
        return 0;
    const prefix = `${apiPrefix || ""}`.replace(/\/+$/, "");
    const relative = prefix && raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, relative.replace(/^\/+/, "")), {
        method: "DELETE",
        headers: buildApiHeaders(),
    });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        throw documentRequestError("清空收藏失败，请稍后重试。", resp.status, envelope);
    }
    const payload = unwrapEnvelope(await resp.json());
    return Number(payload?.deleted_count) || 0;
}
export async function translateDocument(apiPrefix, documentId, payload = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/translate`), {
        method: "POST",
        headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        throw pageQuotaErrorFromPayload(resp.status, envelope) ?? documentRequestError("发起翻译失败，请稍后重试。", resp.status, envelope);
    }
    return unwrapEnvelope(await resp.json());
}
export async function ocrDocument(apiPrefix, documentId, payload = {}) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 document_id。");
    const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/ocr`), {
        method: "POST",
        headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const envelope = await resp.json().catch(() => null);
        throw pageQuotaErrorFromPayload(resp.status, envelope) ?? new Error(`${envelope?.message || "发起 OCR 失败，请稍后重试。"}(${resp.status})`);
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
    const resp = await apiFetch(`${buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/jobs`)}?${params.toString()}`, { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取文档任务失败，请稍后重试。(${resp.status})`);
    const payload = unwrapEnvelope(await resp.json());
    return {
        ...payload,
        items: Array.isArray(payload?.items) ? payload.items : [],
    };
}
