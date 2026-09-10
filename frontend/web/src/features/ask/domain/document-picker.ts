// @ 选择器：文档 + 合集，本地过滤

import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  listCollections,
  fetchDocumentList,
  type DocumentRecord,
} from "@/platform/api/index.js";
import type { HomeAskCollectionScope, HomeAskDocScope, HomeAskScope } from "./types.js";
import { scopeKey } from "./types.js";

export function documentToScope(doc: DocumentRecord | Record<string, unknown>): HomeAskDocScope {
  const d = doc as DocumentRecord;
  const title = `${d.title || d.source_filename || d.document_id || "未命名"}`.trim();
  const jobId = `${d.active_job_id || ""}`.trim();
  return {
    kind: "document",
    id: `${d.document_id || ""}`.trim(),
    title,
    job_id: jobId || undefined,
    source_filename: `${d.source_filename || ""}`.trim() || undefined,
  };
}

/** 兼容旧测试/调用 */
export function documentToRef(doc: DocumentRecord | Record<string, unknown>): HomeAskDocScope {
  return documentToScope(doc);
}

export async function loadDocumentPickerOptions(limit = 80): Promise<HomeAskDocScope[]> {
  const res = await fetchDocumentList(API_PREFIX, { limit, offset: 0 });
  const docs = Array.isArray(res?.documents) ? res.documents : [];
  return docs
    .map((d) => documentToScope(d))
    .filter((d) => d.id);
}

export async function loadCollectionPickerOptions(): Promise<HomeAskCollectionScope[]> {
  const res = await listCollections(API_PREFIX) as {
    collections?: Array<{
      collection_id?: string;
      name?: string;
      document_count?: number;
    }>;
  };
  const list = Array.isArray(res?.collections) ? res.collections : [];
  return list
    .map((c) => ({
      kind: "collection" as const,
      id: `${c.collection_id || ""}`.trim(),
      title: `${c.name || c.collection_id || "未命名合集"}`.trim(),
      document_count: Number(c.document_count) || 0,
    }))
    .filter((c) => c.id);
}

/** 文档 + 合集一并加载，合集排在前面便于发现 */
export async function loadPickerOptions(docLimit = 100): Promise<HomeAskScope[]> {
  const [docs, cols] = await Promise.all([
    loadDocumentPickerOptions(docLimit).catch(() => [] as HomeAskDocScope[]),
    loadCollectionPickerOptions().catch(() => [] as HomeAskCollectionScope[]),
  ]);
  return [...cols, ...docs];
}

export function filterDocumentOptions(
  options: HomeAskScope[],
  query = "",
  excludeKeys: string[] = [],
): HomeAskScope[] {
  const q = `${query || ""}`.trim().toLowerCase();
  const excluded = new Set(excludeKeys.map((id) => id.trim()).filter(Boolean));
  return options
    .filter((opt) => !excluded.has(scopeKey(opt)))
    .filter((opt) => {
      if (!q) return true;
      if (opt.kind === "collection") {
        const hay = `合集 ${opt.title} ${opt.id}`.toLowerCase();
        return hay.includes(q);
      }
      const hay = `${opt.title} ${opt.source_filename || ""} ${opt.id}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 16);
}

/** 展开合集为文档列表（用于提问范围） */
export async function resolveCollectionDocuments(
  collectionId: string,
  limit = 80,
): Promise<HomeAskDocScope[]> {
  const id = `${collectionId || ""}`.trim();
  if (!id) return [];
  const res = await fetchDocumentList(API_PREFIX, {
    limit,
    offset: 0,
    collectionId: id,
  });
  const docs = Array.isArray(res?.documents) ? res.documents : [];
  return docs.map((d) => documentToScope(d)).filter((d) => d.id);
}

/** 从 textarea 文本里解析当前 @ 查询 */
export function parseAtQuery(text: string, caret: number): { start: number; query: string } | null {
  const head = `${text || ""}`.slice(0, Math.max(0, caret));
  const match = head.match(/(^|[\s\u3000])@([^\s@]*)$/);
  if (!match) return null;
  const atIndex = head.lastIndexOf("@");
  if (atIndex < 0) return null;
  return {
    start: atIndex,
    query: match[2] || "",
  };
}
