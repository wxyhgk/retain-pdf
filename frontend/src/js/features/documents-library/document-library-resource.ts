// Resource wrapper cho nguồn dữ liệu lưới document-centric (kế hoạch F2), mirror shape của
// recent-jobs/library-books-resource.js để engine recent-jobs dùng trong loader.js/bindings.js
// như libraryBooksResource.

import { createResource } from "../../app-framework/resource.js";
import { RECENT_JOBS_PAGE_SIZE } from "../recent-jobs/pagination.js";
import { collectDocumentLibraryPage } from "./document-library-source.js";

function normalizeExistingJobIds(value) {
  if (value instanceof Set) {
    return value;
  }
  return new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => `${item || ""}`.trim())
      .filter(Boolean),
  );
}

export function createDocumentLibraryResource({
  fetchDocumentList,
  fetchLibraryBookList,
  apiPrefix,
}: any = {}) {
  return createResource({
    name: "documentLibrary",
    cacheKey: ({
      startOffset = 0,
      pageSize = RECENT_JOBS_PAGE_SIZE,
      query = "",
      existingJobIds = [],
    } = {}) => JSON.stringify({
      startOffset: Number(startOffset) || 0,
      pageSize: Number(pageSize) || RECENT_JOBS_PAGE_SIZE,
      query: `${query || ""}`.trim(),
      existingJobIds: Array.from(normalizeExistingJobIds(existingJobIds)).sort(),
    }),
    loader: ({
      startOffset = 0,
      pageSize = RECENT_JOBS_PAGE_SIZE,
      existingJobIds = new Set(),
      query = "",
    } = {}) => collectDocumentLibraryPage({
      fetchDocumentList,
      fetchLibraryBookList,
      apiPrefix,
      startOffset,
      pageSize,
      existingJobIds: normalizeExistingJobIds(existingJobIds),
      query,
    }),
  });
}
