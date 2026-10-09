import {
  addMockCollectionDocuments,
  createMockCollection,
  deleteMockCollection,
  getMockCollectionList,
  patchMockCollection,
  removeMockCollectionDocument,
} from "@/platform/mock/documents.js";
import type { MockCollectionPatch } from "@/platform/mock/documents.types.js";

export async function listCollections(apiPrefix: string) {
  void apiPrefix;
  return getMockCollectionList();
}

export async function createCollection(apiPrefix: string, { name, parentId = "" }: { name?: string; parentId?: string } = {}) {
  void apiPrefix;
  return createMockCollection({ name, parent_id: parentId || null });
}

// body 支持 { name?, sort_order? }
export async function patchCollection(apiPrefix: string, collectionId: string, payload: MockCollectionPatch = {}) {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 collection_id。");
  }
  void apiPrefix;
  return patchMockCollection(normalized, payload);
}

export async function deleteCollection(apiPrefix: string, collectionId: string) {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 collection_id。");
  }
  void apiPrefix;
  return deleteMockCollection(normalized);
}

export async function addDocumentsToCollection(apiPrefix: string, collectionId: string, documentIds: string[] = []) {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 collection_id。");
  }
  void apiPrefix;
  return addMockCollectionDocuments(normalized, documentIds);
}

export async function removeDocumentFromCollection(apiPrefix: string, collectionId: string, documentId: string) {
  const normalizedCollectionId = `${collectionId || ""}`.trim();
  const normalizedDocumentId = `${documentId || ""}`.trim();
  if (!normalizedCollectionId || !normalizedDocumentId) {
    throw new Error("缺少 collection_id 或 document_id。");
  }
  void apiPrefix;
  return removeMockCollectionDocument(normalizedCollectionId, normalizedDocumentId);
}
