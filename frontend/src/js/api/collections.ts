import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import {
  addMockCollectionDocuments,
  createMockCollection,
  deleteMockCollection,
  getMockCollectionList,
  patchMockCollection,
  removeMockCollectionDocument,
} from "../mock/documents.js";
import { buildApiEndpoint } from "./http.js";

export async function listCollections(apiPrefix) {
  if (isMockMode()) {
    return getMockCollectionList();
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, "collections"), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Không thể tải danh mục, vui lòng thử lại sau.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function createCollection(apiPrefix, { name, parentId = "" }: any = {}) {
  if (isMockMode()) {
    return createMockCollection({ name, parent_id: parentId || null });
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, "collections"), {
    method: "POST",
    headers: {
      ...buildApiHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, parent_id: parentId || undefined }),
  });
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "Không thể tạo danh mục, vui lòng thử lại sau."}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json()) as {
    collection_id?: string;
    name?: string;
    [key: string]: unknown;
  };
}

// body hỗ trợ { name?, sort_order? }
export async function patchCollection(apiPrefix, collectionId, payload = {}) {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) {
    throw new Error("Thiếu collection_id.");
  }
  if (isMockMode()) {
    return patchMockCollection(normalized, payload);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `collections/${encodeURIComponent(normalized)}`), {
    method: "PATCH",
    headers: {
      ...buildApiHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "Không thể cập nhật danh mục, vui lòng thử lại sau."}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function deleteCollection(apiPrefix, collectionId) {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) {
    throw new Error("Thiếu collection_id.");
  }
  if (isMockMode()) {
    return deleteMockCollection(normalized);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `collections/${encodeURIComponent(normalized)}`), {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "Không thể xóa danh mục, vui lòng thử lại sau."}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function addDocumentsToCollection(apiPrefix, collectionId, documentIds = []) {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) {
    throw new Error("Thiếu collection_id.");
  }
  if (isMockMode()) {
    return addMockCollectionDocuments(normalized, documentIds);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `collections/${encodeURIComponent(normalized)}/documents`), {
    method: "POST",
    headers: {
      ...buildApiHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ document_ids: documentIds }),
  });
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "Không thể thêm vào danh mục, vui lòng thử lại sau."}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function removeDocumentFromCollection(apiPrefix, collectionId, documentId) {
  const normalizedCollectionId = `${collectionId || ""}`.trim();
  const normalizedDocumentId = `${documentId || ""}`.trim();
  if (!normalizedCollectionId || !normalizedDocumentId) {
    throw new Error("Thiếu collection_id hoặc document_id.");
  }
  if (isMockMode()) {
    return removeMockCollectionDocument(normalizedCollectionId, normalizedDocumentId);
  }
  const resp = await fetch(
    buildApiEndpoint(
      apiPrefix,
      `collections/${encodeURIComponent(normalizedCollectionId)}/documents/${encodeURIComponent(normalizedDocumentId)}`,
    ),
    {
      method: "DELETE",
      headers: buildApiHeaders(),
    },
  );
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "Không thể xóa khỏi danh mục, vui lòng thử lại sau."}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
