import {
  clearMockFavoritesForDocument,
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
import { assertKnownJobPayloadFields } from "./job-payload-contract.js";

/** Document record returned by documents API (media URLs included). */
export type DocumentRecord = MockDocumentWithMedia;

export async function fetchDocumentList(
  apiPrefix: string,
  {
    limit = 50,
    offset = 0,
    readingStatus = "",
    tag = "",
    collectionId = "",
    q = "",
  }: {
    limit?: number;
    offset?: number;
    readingStatus?: string;
    tag?: string;
    collectionId?: string;
    q?: string;
  } = {},
): Promise<MockDocumentListResult> {
  void apiPrefix;
  return getMockDocumentList({ limit, offset, readingStatus, tag, collectionId, q });
}

// 按任意 job_id(含历史 run)直查其所属文档,后端负责解析——前端不再扫列表反查。
// 返回该文档记录或 null(job 不属于任何文档时)。
export async function fetchDocumentByJobId(
  apiPrefix: string,
  jobId: string,
): Promise<DocumentRecord | null> {
  void apiPrefix;
  const normalized = `${jobId || ""}`.trim();
  if (!normalized) {
    return null;
  }
  return getMockDocumentByJobId(normalized);
}

export async function fetchDocument(
  apiPrefix: string,
  documentId: string,
): Promise<DocumentRecord> {
  void apiPrefix;
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 document_id。");
  }
  return getMockDocument(normalized);
}

// body 支持 { title?, reading_status?, tags? };tags 是整体替换语义(传 [] 即清空)
export async function patchDocument(
  apiPrefix: string,
  documentId: string,
  payload: MockDocumentPatch = {},
): Promise<DocumentRecord> {
  void apiPrefix;
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 document_id。");
  }
  return patchMockDocument(normalized, payload);
}

// 文档级删除:删掉 document + 名下所有 job/upload/文件(后端 DELETE /documents/:id)。
// 被收藏引用时后端返回 409(force 可覆盖运行中的 job,不覆盖收藏保护)。
export async function deleteDocument(apiPrefix, documentId, { force = false } = {}) {
  void apiPrefix;
  void force;
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 document_id。");
  }
  return deleteMockDocument(normalized);
}

// DELETE clear_favorites_path（后端在 DELETE_BLOCKED_BY_FAVORITES.details 里给的
// 路径；文档级/run 级共用）。返回实际删除的收藏条数。
export async function clearFavorites(apiPrefix, clearFavoritesPath) {
  void apiPrefix;
  const raw = `${clearFavoritesPath || ""}`.trim();
  if (!raw) return 0;
  // mock 只实现了文档级清空；run 级路径同样解析到所属文档。
  const match = raw.match(/\/documents\/([^/]+)\/favorites$/);
  return match ? clearMockFavoritesForDocument(decodeURIComponent(match[1])) : 0;
}

// 对馆藏文档发起"以后再翻":复用文档已存的 upload 起 book 翻译 job。
// 后端 translate_document 会注入该文档的 upload_id 并把 workflow 归一到 book/translate,
// 前端只需带一个最小 CreateJobInput(workflow 缺省即 book)。返回 JobSubmissionView。
export async function translateDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<JobSubmissionView> {
  void apiPrefix;
  assertKnownJobPayloadFields(payload, { label: "/documents/:id/translate" });
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 document_id。");
  }
  return translateMockDocument(normalized);
}

export async function ocrDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<JobSubmissionView> {
  void apiPrefix;
  assertKnownJobPayloadFields(payload, { label: "/documents/:id/ocr" });
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  return ocrMockDocument(normalized);
}

export async function fetchDocumentJobs(
  apiPrefix: string,
  documentId: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<any> {
  void apiPrefix;
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) return { items: [] };
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
