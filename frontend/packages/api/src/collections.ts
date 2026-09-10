// collections — pure
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";

export async function listCollections(apiPrefix: string): Promise<any> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, "collections"), { headers: buildApiHeaders() });
  if (!resp.ok) throw new Error(`读取分类失败，请稍后重试。(${resp.status})`);
  return unwrapEnvelope(await resp.json());
}

export async function createCollection(apiPrefix: string, { name, parentId = "" }: any = {}): Promise<any> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, "collections"), {
    method: "POST",
    headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent_id: parentId || undefined }),
  });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "新建分类失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json()) as { collection_id?: string; name?: string; [key: string]: unknown };
}

export async function patchCollection(apiPrefix: string, collectionId: string, payload: Record<string, unknown> = {}): Promise<any> {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) throw new Error("缺少 collection_id。");
  const resp = await fetch(buildApiEndpoint(apiPrefix, `collections/${encodeURIComponent(normalized)}`), {
    method: "PATCH",
    headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "更新分类失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function deleteCollection(apiPrefix: string, collectionId: string): Promise<any> {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) throw new Error("缺少 collection_id。");
  const resp = await fetch(buildApiEndpoint(apiPrefix, `collections/${encodeURIComponent(normalized)}`), { method: "DELETE", headers: buildApiHeaders() });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "删除分类失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function addDocumentsToCollection(apiPrefix: string, collectionId: string, documentIds: string[] = []): Promise<any> {
  const normalized = `${collectionId || ""}`.trim();
  if (!normalized) throw new Error("缺少 collection_id。");
  const resp = await fetch(buildApiEndpoint(apiPrefix, `collections/${encodeURIComponent(normalized)}/documents`), {
    method: "POST",
    headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ document_ids: documentIds }),
  });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "加入分类失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function removeDocumentFromCollection(apiPrefix: string, collectionId: string, documentId: string): Promise<any> {
  const normalizedCollectionId = `${collectionId || ""}`.trim();
  const normalizedDocumentId = `${documentId || ""}`.trim();
  if (!normalizedCollectionId || !normalizedDocumentId) throw new Error("缺少 collection_id 或 document_id。");
  const resp = await fetch(buildApiEndpoint(apiPrefix, `collections/${encodeURIComponent(normalizedCollectionId)}/documents/${encodeURIComponent(normalizedDocumentId)}`), {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "移出分类失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
