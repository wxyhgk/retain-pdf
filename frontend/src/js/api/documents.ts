import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import {
  deleteMockDocument,
  getMockDocument,
  getMockDocumentByJobId,
  getMockDocumentList,
  patchMockDocument,
  translateMockDocument,
  type MockDocumentListResult,
  type MockDocumentPatch,
  type MockDocumentWithMedia,
} from "../mock/documents.js";
import type { JobSubmissionView } from "../../pages/home/features/library/types.js";
import { buildApiEndpoint } from "./http.js";

/** Bản ghi tài liệu trả về bởi API documents (bao gồm media URLs). */
export type DocumentRecord = MockDocumentWithMedia;

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
    throw new Error(`Đọc thư viện tài liệu thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope<MockDocumentListResult>(await resp.json());
}

// Tra cứu trực tiếp tài liệu thuộc về theo bất kỳ job_id (bao gồm lịch sử run), backend chịu trách nhiệm phân giải - frontend không quét danh sách ngược lại.
// Trả về bản ghi tài liệu hoặc null (khi job không thuộc về tài liệu nào).
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
    throw new Error(`Tìm tài liệu theo job thất bại, vui lòng thử lại sau. (${resp.status})`);
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
    throw new Error("Thiếu document_id.");
  }
  if (isMockMode()) {
    return getMockDocument(normalized);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Đọc chi tiết tài liệu thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

// body hỗ trợ { title?, reading_status?, tags? }; tags có ngữ nghĩa thay thế toàn bộ (truyền [] tức là xóa trắng)
export async function patchDocument(
  apiPrefix: string,
  documentId: string,
  payload: MockDocumentPatch = {},
): Promise<DocumentRecord> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("Thiếu document_id.");
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
    throw new Error(`${envelope?.message || "Cập nhật tài liệu thất bại, vui lòng thử lại sau."}(${resp.status})`);
  }
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

// Xóa cấp tài liệu: xóa document + tất cả job/upload/tệp dưới tên (backend DELETE /documents/:id).
// Khi được trích dẫn bởi yêu thích, backend trả về 409 (force có thể ghi đè job đang chạy, không ghi đè bảo vệ yêu thích).
export async function deleteDocument(apiPrefix, documentId, { force = false } = {}) {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("Thiếu document_id.");
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
    const error = new Error(`${envelope?.message || "Xóa tài liệu thất bại, vui lòng thử lại sau."}(${resp.status})`) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }
  return unwrapEnvelope(await resp.json());
}

// Khởi tạo "Dịch sau" cho tài liệu lưu trữ: tái sử dụng upload đã lưu của tài liệu để bắt đầu job dịch book.
// Backend translate_document sẽ tiêm upload_id của tài liệu và chuẩn hóa workflow về book/translate,
// Frontend chỉ cần mang theo CreateJobInput tối thiểu (workflow mặc định là book). Trả về JobSubmissionView.
export async function translateDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<JobSubmissionView> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
    throw new Error("Thiếu document_id.");
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
    throw new Error(`${envelope?.message || "Bắt đầu dịch thất bại, vui lòng thử lại sau."}(${resp.status})`);
  }
  return unwrapEnvelope<JobSubmissionView>(await resp.json());
}
