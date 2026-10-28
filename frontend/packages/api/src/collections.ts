// collections — 走生成的请求函数（契约 library-documents.v1），这里只管参数整理和给用户看的报错。
import * as generated from "./generated/library-documents.js";
import { encodePathParam, failWith, failWithServerMessage, request } from "./request.js";
import type {
  CollectionDeleteResultView,
  CollectionDocumentRemoveResultView,
  CollectionListView,
  CollectionRecord,
  PatchCollectionInput,
} from "@retainpdf/contracts/library-documents";

export type { CollectionListView, CollectionRecord, PatchCollectionInput };

function requireCollectionId(collectionId: string): string {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) throw new Error("缺少 collection_id。");
  return normalized;
}

export async function listCollections(apiPrefix: string): Promise<CollectionListView> {
  return generated.listCollections(apiPrefix, {}, { onError: failWith("读取分类失败，请稍后重试。") });
}

export async function createCollection(
  apiPrefix: string,
  { name, parentId = "" }: { name?: string; parentId?: string } = {},
): Promise<CollectionRecord> {
  return generated.createCollection(
    apiPrefix,
    { body: { name: name ?? "", parent_id: parentId || undefined } },
    { onError: failWithServerMessage("新建分类失败，请稍后重试。") },
  );
}

export async function patchCollection(
  apiPrefix: string,
  collectionId: string,
  payload: PatchCollectionInput = {},
): Promise<CollectionRecord> {
  return generated.patchCollection(
    apiPrefix,
    { collection_id: requireCollectionId(collectionId), body: payload },
    { onError: failWithServerMessage("更新分类失败，请稍后重试。") },
  );
}

export async function deleteCollection(apiPrefix: string, collectionId: string): Promise<CollectionDeleteResultView> {
  return generated.deleteCollection(
    apiPrefix,
    { collection_id: requireCollectionId(collectionId) },
    { onError: failWithServerMessage("删除分类失败，请稍后重试。") },
  );
}

export async function addDocumentsToCollection(apiPrefix: string, collectionId: string, documentIds: string[] = []): Promise<CollectionRecord> {
  return generated.addCollectionDocuments(
    apiPrefix,
    { collection_id: requireCollectionId(collectionId), body: { document_ids: documentIds } },
    { onError: failWithServerMessage("加入分类失败，请稍后重试。") },
  );
}

export async function removeDocumentFromCollection(apiPrefix: string, collectionId: string, documentId: string): Promise<CollectionDocumentRemoveResultView> {
  const normalizedCollectionId = `${collectionId || ""}`.trim();
  const normalizedDocumentId = `${documentId || ""}`.trim();
  if (!normalizedCollectionId || !normalizedDocumentId) throw new Error("缺少 collection_id 或 document_id。");
  return generated.removeCollectionDocument(
    apiPrefix,
    { collection_id: normalizedCollectionId, document_id: normalizedDocumentId },
    { onError: failWithServerMessage("移出分类失败，请稍后重试。") },
  );
}

/** 物化一个文件夹的 agent 工作区（终端切到「文件夹」作用域之前调）。返回 {books: [...]}。
 * 属于 AI 那批，契约里还没有这条，先借生成层的 request() 发，不另手写请求。 */
export async function materializeCollectionWorkspace(apiPrefix: string, collectionId: string): Promise<{ books?: unknown[] } | null> {
  return request({
    apiPrefix,
    // 物化会重建磁盘上的目录，所以是 POST（2026-10-19 前是 GET，旧写法后端标了旧地址）。
    method: "POST",
    path: `collections/${encodePathParam(requireCollectionId(collectionId))}/agent-workspace`,
    options: { onError: failWith("准备文件夹工作区失败") },
  });
}
