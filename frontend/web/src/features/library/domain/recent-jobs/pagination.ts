import { flattenStageSnapshot } from "@retainpdf/domain/job";
import {
  dedupeLibraryCards,
  libraryCardIdentity,
  libraryCardIdentityAliases,
} from "./library-card-identity.js";
import type { LibraryJobItem } from "./runtime-item.js";

export const RECENT_JOBS_PAGE_SIZE = 24;

export type RecentJobsPagePayload = {
  items?: LibraryJobItem[];
  has_more?: boolean;
  invocation_summary?: unknown;
};

export type RecentJobsPageFetcher = (
  apiPrefix: string,
  opts: { limit: number; offset: number; q: string },
) => Promise<RecentJobsPagePayload>;

export function dedupeRecentJobs(
  items: LibraryJobItem[] | null | undefined,
): LibraryJobItem[] {
  return dedupeLibraryCards(items);
}

export function isPrimaryRecentJob(item: LibraryJobItem | null | undefined) {
  const jobId = `${item?.job_id || ""}`.trim();
  // Translation workflows create a canonical `<parent>-ocr` child. Standalone
  // OCR jobs are document roots and must remain visible in the library.
  if (jobId.endsWith("-ocr")) {
    return false;
  }
  return true;
}

export async function collectRecentJobsPage({
  fetchJobList,
  fetchLibraryBookList,
  apiPrefix,
  startOffset,
  pageSize,
  existingJobIds = new Set(),
  query = "",
}: {
  fetchJobList?: RecentJobsPageFetcher;
  fetchLibraryBookList?: RecentJobsPageFetcher;
  apiPrefix: string;
  startOffset: number;
  pageSize: number;
  existingJobIds?: Iterable<string> | null;
  query?: string;
}) {
  const fetchLimit = Math.max(pageSize, 20);
  const collected = [];
  const seenCardIdentities = new Set(
    Array.from(existingJobIds || [])
      .map((value) => `${value || ""}`.trim())
      .filter(Boolean)
      .map((value) => (
        value.startsWith("document:") || value.startsWith("job:")
          ? value
          : `job:${value}`
      )),
  );
  let latestInvocationSummary = null;
  let nextOffset = startOffset;
  let hasMore = true;
  let requestCount = 0;
  let zeroGrowthPages = 0;

  while (collected.length < pageSize) {
    requestCount += 1;
    let payload = null;
    if (fetchJobList) {
      payload = await fetchJobList(apiPrefix, { limit: fetchLimit, offset: nextOffset, q: query });
    } else if (fetchLibraryBookList) {
      payload = await fetchLibraryBookList(apiPrefix, { limit: fetchLimit, offset: nextOffset, q: query });
    }
    latestInvocationSummary = payload?.invocation_summary || latestInvocationSummary;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const pageHasMore = payload?.has_more;
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    const beforeCount = collected.length;
    // P0: count raw rows actually scanned. Filling the page only stops the
    // push; the unconsumed tail stays server-side and is refetched from the
    // returned nextOffset instead of being skipped by a full fetchLimit jump.
    let consumedRows = 0;
    for (const item of items) {
      consumedRows += 1;
      if (!isPrimaryRecentJob(item)) {
        continue;
      }
      const identity = libraryCardIdentity(item);
      const aliases = libraryCardIdentityAliases(item);
      if (!identity || aliases.some((alias) => seenCardIdentities.has(alias))) {
        continue;
      }
      aliases.forEach((alias) => seenCardIdentities.add(alias));
      collected.push(flattenStageSnapshot(item));
      if (collected.length >= pageSize) {
        break;
      }
    }

    nextOffset += consumedRows;

    // P1: a capped server page may be shorter than fetchLimit. Trust an
    // explicit has_more signal when present; only use the short-page
    // heuristic when the field is absent.
    if (pageHasMore === false) {
      hasMore = false;
      break;
    }
    if (pageHasMore !== true && items.length < fetchLimit) {
      hasMore = false;
      break;
    }
    if (collected.length >= pageSize) {
      break;
    }
    if (requestCount >= 12) {
      hasMore = false;
      break;
    }
    // P1: a fully filtered page is zero growth, not exhaustion. Keep pulling
    // the next page; only consecutive zero-growth pages mean no more.
    if (collected.length === beforeCount) {
      zeroGrowthPages += 1;
      if (zeroGrowthPages >= 2) {
        hasMore = false;
        break;
      }
    } else {
      zeroGrowthPages = 0;
    }
  }

  return {
    collected,
    hasMore,
    latestInvocationSummary,
    nextOffset,
  };
}
