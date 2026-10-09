// 文档中心网格的分页数据源(计划 F2)。返回形状与
// recent-jobs/pagination.js#collectRecentJobsPage 对齐
// ({ collected, hasMore, latestInvocationSummary, nextOffset }),这样
// recent-jobs 的 loader.js/commit.js/store 引擎可以一行不改地消费它。
//
// 每篇文档产出一张卡:先拉一页 /documents,收集该页 active_job_id,批量向
// library/books?job_ids= 取这些 job 的实时活态,再按 job_id 合并
// (shapeDocumentCardItem)。馆藏文档(无 active_job_id)拿合成 job_id 穿过引擎。
//
// 搜索：query 经 `q` 透传给后端（标题/原始文件名 LIKE，total 已是过滤后计数），
// 分页照常走 limit/offset，不做客户端过滤或首屏多拉。

import {
  shapeDocumentsWithBooks,
} from "./shape-documents-with-books.js";
import type {
  JobPayloadFetcher,
  LibraryBookListFetcher,
} from "./shape-documents-with-books.js";
import { shapeDocumentCardItem } from "./document-card-item.js";
import type { LibraryDocumentRecord } from "./document-card-item.js";
import {
  libraryCardIdentity,
  libraryCardIdentityAliases,
} from "../recent-jobs/library-card-identity.js";

function normalizedJobId(value) {
  return `${value || ""}`.trim();
}

function normalizedExistingCardIdentity(value) {
  const normalized = normalizedJobId(value);
  if (!normalized) return "";
  return normalized.startsWith("document:") || normalized.startsWith("job:")
    ? normalized
    : `job:${normalized}`;
}

export type DocumentListPayload = {
  documents?: LibraryDocumentRecord[];
  total?: number;
};

export type DocumentListFetcher = (
  apiPrefix: string,
  opts: { limit: number; offset: number; q?: string },
) => Promise<DocumentListPayload>;

export type DocumentLibraryPreview = {
  collected: ReturnType<typeof shapeDocumentCardItem>[];
  hasMore: boolean;
  nextOffset: number;
  latestInvocationSummary: null;
};

export async function collectDocumentLibraryPage({
  fetchDocumentList,
  fetchLibraryBookList,
  fetchJobPayload,
  apiPrefix,
  startOffset = 0,
  pageSize,
  existingJobIds = new Set(),
  query = "",
  onPreview,
}: {
  fetchDocumentList: DocumentListFetcher;
  fetchLibraryBookList?: LibraryBookListFetcher;
  fetchJobPayload?: JobPayloadFetcher;
  apiPrefix: string;
  startOffset?: number;
  pageSize: number;
  existingJobIds?: Set<string> | string[];
  query?: string;
  onPreview?: (page: DocumentLibraryPreview) => void;
}) {
  const trimmedQuery = `${query || ""}`.trim();
  const seenCardIdentities = new Set(
    Array.from(existingJobIds instanceof Set
      ? existingJobIds
      : (Array.isArray(existingJobIds) ? existingJobIds : []))
      .map(normalizedExistingCardIdentity)
      .filter(Boolean),
  );

  const limit = pageSize;
  const offset = startOffset;

  const payload = await fetchDocumentList(apiPrefix, {
    limit,
    offset,
    ...(trimmedQuery ? { q: trimmedQuery } : null),
  });
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  // `total` is the server-side count for the same filter snapshot. Pagination
  // must not infer this from the current page length, especially on a full
  // first page where both values happen to look identical.
  const responseTotal = Number(payload?.total);
  const total = Number.isFinite(responseTotal) && responseTotal >= 0
    ? responseTotal
    : offset + documents.length;

  // Publish bibliographic data before live projections/OCR fallbacks. This
  // callback is request-scoped; the loader owns stale/disposed-view guards.
  const preview = documents.map((doc) => ({
    ...shapeDocumentCardItem(doc),
    runtime_pending: Boolean(doc.active_job_id),
  }));
  const hasMore = offset + documents.length < total;
  const nextOffset = offset + documents.length;
  if (typeof onPreview === "function") {
    onPreview({ collected: preview, hasMore, nextOffset, latestInvocationSummary: null });
  }

  // 文档 → 卡片的映射走统一编排(shapeDocumentsWithBooks);去重是分页数据源
  // 自己的关切（搜索过滤已在服务端完成）。
  let shaped;
  try {
    shaped = await shapeDocumentsWithBooks(documents, {
      fetchLibraryBookList, fetchJobPayload, apiPrefix,
    });
    if (typeof onPreview === "function") {
      shaped = shaped.map((item) => ({
        ...item, runtime_pending: false,
        runtime_unavailable: Boolean(item.active_job_id && !item.status),
      }));
    }
  } catch (error) {
    if (typeof onPreview !== "function") throw error;
    // An optional live-state failure must not hide the available documents.
    shaped = preview.map((item) => ({ ...item, runtime_pending: false, runtime_unavailable: true }));
  }

  const collected = [];
  for (const item of shaped) {
    const identity = libraryCardIdentity(item);
    const aliases = libraryCardIdentityAliases(item);
    if (!identity || aliases.some((alias) => seenCardIdentities.has(alias))) {
      continue;
    }
    aliases.forEach((alias) => seenCardIdentities.add(alias));
    collected.push(item);
  }

  return {
    collected,
    hasMore,
    latestInvocationSummary: null,
    nextOffset,
  };
}
