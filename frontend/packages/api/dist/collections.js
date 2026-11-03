// collections — 走生成的请求函数（契约 library-documents.v1），这里只管参数整理和给用户看的报错。
import * as generated from "./generated/library-documents.js";
import { failWith, failWithServerMessage } from "./request.js";
function requireCollectionId(collectionId) {
    const normalized = `${collectionId || ""}`.trim();
    if (!normalized)
        throw new Error("缺少 collection_id。");
    return normalized;
}
export async function listCollections(apiPrefix) {
    return generated.listCollections(apiPrefix, {}, { onError: failWith("读取分类失败，请稍后重试。") });
}
export async function createCollection(apiPrefix, { name, parentId = "" } = {}) {
    return generated.createCollection(apiPrefix, { body: { name: name ?? "", parent_id: parentId || undefined } }, { onError: failWithServerMessage("新建分类失败，请稍后重试。") });
}
export async function patchCollection(apiPrefix, collectionId, payload = {}) {
    return generated.patchCollection(apiPrefix, { collection_id: requireCollectionId(collectionId), body: payload }, { onError: failWithServerMessage("更新分类失败，请稍后重试。") });
}
export async function deleteCollection(apiPrefix, collectionId) {
    return generated.deleteCollection(apiPrefix, { collection_id: requireCollectionId(collectionId) }, { onError: failWithServerMessage("删除分类失败，请稍后重试。") });
}
export async function addDocumentsToCollection(apiPrefix, collectionId, documentIds = []) {
    return generated.addCollectionDocuments(apiPrefix, { collection_id: requireCollectionId(collectionId), body: { document_ids: documentIds } }, { onError: failWithServerMessage("加入分类失败，请稍后重试。") });
}
export async function removeDocumentFromCollection(apiPrefix, collectionId, documentId) {
    const normalizedCollectionId = `${collectionId || ""}`.trim();
    const normalizedDocumentId = `${documentId || ""}`.trim();
    if (!normalizedCollectionId || !normalizedDocumentId)
        throw new Error("缺少 collection_id 或 document_id。");
    return generated.removeCollectionDocument(apiPrefix, { collection_id: normalizedCollectionId, document_id: normalizedDocumentId }, { onError: failWithServerMessage("移出分类失败，请稍后重试。") });
}
