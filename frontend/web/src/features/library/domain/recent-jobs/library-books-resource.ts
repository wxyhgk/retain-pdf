import { createResource } from "@/platform/store/resource.js";
import {
  collectRecentJobsPage,
  RECENT_JOBS_PAGE_SIZE,
} from "./pagination.js";
import type { RecentJobsPageFetcher } from "./pagination.js";

/** 分页加载参数（书架列表资源的 load 入参，也决定缓存键）。 */
export type LibraryPageParams = {
  startOffset?: number;
  pageSize?: number;
  query?: string;
  existingJobIds?: Set<string> | string[];
};

export function normalizeExistingJobIds(value: LibraryPageParams["existingJobIds"] | Iterable<string> | null | undefined): Set<string> {
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
}: {
  fetchJobList?: RecentJobsPageFetcher;
  fetchLibraryBookList?: RecentJobsPageFetcher;
  apiPrefix: string;
}) {
  return createResource({
    name: "libraryBooks",
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
    }: LibraryPageParams = {}) => collectRecentJobsPage({
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

export function invalidateLibraryBooksResource(resource: { invalidate?: () => void } | null | undefined) {
  resource?.invalidate?.();
}
