// 文档中心网格数据源的 resource 包装(计划 F2),镜像
// recent-jobs/library-books-resource.js 的形状,供 recent-jobs 引擎的
// loader.js/bindings.js 当作 libraryBooksResource 注入使用。

import { createResource } from "@/platform/store/resource.js";
import { RECENT_JOBS_PAGE_SIZE } from "../recent-jobs/pagination.js";
import { normalizeExistingJobIds, type LibraryPageParams } from "../recent-jobs/library-books-resource.js";
import { collectDocumentLibraryPage } from "./document-library-source.js";
import type {
  DocumentLibraryPreview,
  DocumentListFetcher,
} from "./document-library-source.js";
import type {
  JobPayloadFetcher,
  LibraryBookListFetcher,
} from "./shape-documents-with-books.js";


export function createDocumentLibraryResource({
  fetchDocumentList,
  fetchLibraryBookList,
  fetchJobPayload,
  apiPrefix,
}: {
  fetchDocumentList: DocumentListFetcher;
  fetchLibraryBookList?: LibraryBookListFetcher;
  fetchJobPayload?: JobPayloadFetcher;
  apiPrefix: string;
}) {
  return createResource({
    name: "documentLibrary",
    cacheKey: ({
      startOffset = 0,
      pageSize = RECENT_JOBS_PAGE_SIZE,
      query = "",
      existingJobIds = [],
    }: LibraryPageParams = {}) => JSON.stringify({
      startOffset: Number(startOffset) || 0,
      pageSize: Number(pageSize) || RECENT_JOBS_PAGE_SIZE,
      query: `${query || ""}`.trim(),
      existingJobIds: Array.from(normalizeExistingJobIds(existingJobIds)).sort(),
    }),
    loader: ({
      startOffset = 0,
      pageSize = RECENT_JOBS_PAGE_SIZE,
      existingJobIds = new Set<string>(),
      query = "",
      onPreview = undefined,
    }: LibraryPageParams & { onPreview?: (page: DocumentLibraryPreview) => void } = {}) => collectDocumentLibraryPage({
      fetchDocumentList,
      fetchLibraryBookList,
      fetchJobPayload,
      apiPrefix,
      startOffset,
      pageSize,
      existingJobIds: normalizeExistingJobIds(existingJobIds),
      query,
      onPreview,
    }),
  });
}
