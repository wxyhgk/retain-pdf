import { buildApiHeaders, isMockMode } from "@/platform/config/runtime.js";
import { unwrapEnvelope } from "@retainpdf/domain/job";
import {
  deleteMockDocument,
  getMockDocument,
  getMockDocumentByJobId,
  getMockDocumentList,
  patchMockDocument,
  getMockDocumentJobs,
  ocrMockDocument,
  translateMockDocument,
  type MockDocumentListResult,
  type MockDocumentPatch,
  type MockDocumentWithMedia,
} from "@/platform/mock/documents.js";
import type { JobSubmissionView } from "@/platform/contracts/library-payloads.js";
import { buildApiEndpoint } from "./http.js";

/** Document record returned by documents API (media URLs included). */
export type DocumentRecord = MockDocumentWithMedia;

type DocumentRequestError = Error & {
  status?: number;
  errorCode?: string;
  reason?: string;
  canFallbackToOcr?: boolean;
};

function documentRequestError(
  fallback: string,
  status: number,
  payload: any,
): DocumentRequestError {
  const details = payload?.details && typeof payload.details === "object"
    ? payload.details
    : payload?.data && typeof payload.data === "object"
      ? payload.data
      : {};
  const error = new Error(`${payload?.message || details?.message || fallback}(${status})`) as DocumentRequestError;
  error.status = status;
  const errorCode = `${payload?.error_code || details?.error_code || details?.code || (typeof payload?.code === "string" ? payload.code : "")}`.trim();
  if (errorCode) error.errorCode = errorCode;
  const reason = `${payload?.reason || details?.reason || ""}`.trim();
  if (reason) error.reason = reason;
  const canFallback = payload?.can_fallback_to_ocr ?? details?.can_fallback_to_ocr;
  if (typeof canFallback === "boolean") error.canFallbackToOcr = canFallback;
  return error;
}

export async function fetchDocumentList(
  apiPrefix: string,
  {
    limit = 50,
    offset = 0,
    readingStatus = "",
    tag = "",
    collectionId = "",
  }: {
    limit?: number;
    offset?: number;
    readingStatus?: string;
    tag?: string;
    collectionId?: string;
  } = {},
): Promise<MockDocumentListResult> {
  if (isMockMode()) {
    return getMockDocumentList({ limit, offset, readingStatus, tag, collectionId });
  }
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  if (`${readingStatus || ""}`.trim()) {
    params.set("reading_status", `${readingStatus}`.trim());
  }
  if (`${tag || ""}`.trim()) {
    params.set("tag", `${tag}`.trim());
  }
  if (`${collectionId || ""}`.trim()) {
    params.set("collection_id", `${collectionId}`.trim());
  }
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`读取文档库失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope<MockDocumentListResult>(await resp.json());
}

// 按任意 job_id(含历史 run)直查其所属文档,后端负责解析——前端不再扫列表反查。
// 返回该文档记录或 null(job 不属于任何文档时)。
export async function fetchDocumentByJobId(
  apiPrefix: string,
  jobId: string,
): Promise<DocumentRecord | null> {
  const normalized = `${jobId || ""}`.trim();
  if (!normalized) {
    return null;
  }
  if (isMockMode()) {
    return getMockDocumentByJobId(normalized);
  }
  const params = new URLSearchParams();
  params.set("job_id", normalized);
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`按 job 查文档失败，请稍后重试。(${resp.status})`);
  }
  const payload = unwrapEnvelope<MockDocumentListResult>(await resp.json()) || {
    documents: [],
    total: 0,
    limit: 0,
    offset: 0,
  };
  const { documents = [] } = payload;
  return Array.isArray(documents) && documents.length ? documents[0] : null;
}

export async function fetchDocument(
  apiPrefix: string,
  documentId: string,
): Promise<DocumentRecord> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 document_id。");
  }
  if (isMockMode()) {
    return getMockDocument(normalized);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`读取文档详情失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

// body 支持 { title?, reading_status?, tags? };tags 是整体替换语义(传 [] 即清空)
export async function patchDocument(
  apiPrefix: string,
  documentId: string,
  payload: MockDocumentPatch = {},
): Promise<DocumentRecord> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 document_id。");
  }
  if (isMockMode()) {
    return patchMockDocument(normalized, payload);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), {
    method: "PATCH",
    headers: {
      ...buildApiHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "更新文档失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

// 文档级删除:删掉 document + 名下所有 job/upload/文件(后端 DELETE /documents/:id)。
// 被收藏引用时后端返回 409(force 可覆盖运行中的 job,不覆盖收藏保护)。
export async function deleteDocument(apiPrefix, documentId, { force = false } = {}) {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 document_id。");
  }
  if (isMockMode()) {
    return deleteMockDocument(normalized);
  }
  const params = force ? "?force=true" : "";
  const resp = await fetch(
    buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`) + params,
    { method: "DELETE", headers: buildApiHeaders() },
  );
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    const error = new Error(`${envelope?.message || "删除文档失败，请稍后重试。"}(${resp.status})`) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }
  return unwrapEnvelope(await resp.json());
}

// 对馆藏文档发起"以后再翻":复用文档已存的 upload 起 book 翻译 job。
// 后端 translate_document 会注入该文档的 upload_id 并把 workflow 归一到 book/translate,
// 前端只需带一个最小 CreateJobInput(workflow 缺省即 book)。返回 JobSubmissionView。
export async function translateDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<JobSubmissionView> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 document_id。");
  }
  if (isMockMode()) {
    return translateMockDocument(normalized);
  }
  const resp = await fetch(
    buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/translate`),
    {
      method: "POST",
      headers: {
        ...buildApiHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw documentRequestError("发起翻译失败，请稍后重试。", resp.status, envelope);
  }
  return unwrapEnvelope<JobSubmissionView>(await resp.json());
}

export async function ocrDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<JobSubmissionView> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  if (isMockMode()) return ocrMockDocument(normalized);
  const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/ocr`), {
    method: "POST",
    headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "发起 OCR 失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope<JobSubmissionView>(await resp.json());
}

export async function submitDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<JobSubmissionView> {
  const workflow = `${(payload as any)?.workflow || ""}`.trim().toLowerCase();
  if (workflow === "ocr") {
    return ocrDocument(apiPrefix, documentId, payload);
  }
  return translateDocument(apiPrefix, documentId, payload);
}

export async function fetchDocumentJobs(
  apiPrefix: string,
  documentId: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<any> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) return { items: [] };
  if (isMockMode()) {
    const payload = getMockDocumentJobs(normalized);
    const allItems = Array.isArray(payload?.items) ? payload.items : [];
    const items = allItems.slice(offset, offset + limit);
    return {
      ...payload,
      items,
      total: allItems.length,
      limit,
      offset,
      has_more: offset + items.length < allItems.length,
    };
  }
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/jobs`)}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) throw new Error(`读取文档任务失败，请稍后重试。(${resp.status})`);
  const payload = unwrapEnvelope<any>(await resp.json());
  return { ...payload, items: Array.isArray(payload?.items) ? payload.items : [] };
}
