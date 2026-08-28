// @ Bộ chọn：Tài liệu + Bộ sưu tập，Lọc cục bộ

import { API_PREFIX } from "../../../../js/config/api-constants.js";
import { listCollections } from "../../../../js/api/collections.js";
import { fetchDocumentList, type DocumentRecord } from "../../../../js/api/documents.js";
import type { HomeAskCollectionScope, HomeAskDocScope, HomeAskScope } from "./types.js";
import { scopeKey } from "./types.js";

export function documentToScope(doc: DocumentRecord | Record<string, unknown>): HomeAskDocScope {
  const d = doc as DocumentRecord;
  const title = `${d.title || d.source_filename || d.document_id || "Chưa đặt tên"}`.trim();
  const jobId = `${d.active_job_id || ""}`.trim();
  return {
    kind: "document",
    id: `${d.document_id || ""}`.trim(),
    title,
    job_id: jobId || undefined,
    source_filename: `${d.source_filename || ""}`.trim() || undefined,
  };
}

/** Tương thích với các bài kiểm tra cũ/điều dụng */
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
      title: `${c.name || c.collection_id || "Bộ sưu tập chưa đặt tên"}`.trim(),
      document_count: Number(c.document_count) || 0,
    }))
    .filter((c) => c.id);
}

/** Tài liệu + Tải các bộ sưu tập cùng nhau，Các bộ sưu tập được sắp xếp ở phía trước để dễ dàng khám phá */
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
        const hay = `Bộ sưu tập ${opt.title} ${opt.id}`.toLowerCase();
        return hay.includes(q);
      }
      const hay = `${opt.title} ${opt.source_filename || ""} ${opt.id}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 16);
}

/** Mở rộng việc thu thập vào danh sách tài liệu（Được sử dụng cho phạm vi câu hỏi） */
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

/** Từ textarea Phân tích cú pháp hiện tại trong văn bản @ tra hỏi */
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
