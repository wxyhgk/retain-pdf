import { createResource } from "@/platform/store/resource.js";
import {
  collectRecentJobsPage,
  RECENT_JOBS_PAGE_SIZE,
} from "./pagination.js";

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

export function createLibraryBooksResource({
  fetchJobList,
  fetchLibraryBookList,
  apiPrefix,
}: any = {}) {
  return createResource({
    name: "libraryBooks",
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
    } = {}) => collectRecentJobsPage({
      fetchJobList,
      fetchLibraryBookList,
      apiPrefix,
      startOffset,
      pageSize,
      existingJobIds: normalizeExistingJobIds(existingJobIds),
      query,
    }),
  });
}

export function invalidateLibraryBooksResource(resource) {
  resource?.invalidate?.();
}
