import { flattenStageSnapshot } from "@retainpdf/domain/job";
import {
  dedupeLibraryCards,
  libraryCardIdentity,
  libraryCardIdentityAliases,
} from "./library-card-identity.js";
import type { LibraryJobItem } from "./runtime-item.js";

export const RECENT_JOBS_PAGE_SIZE = 24;

export function dedupeRecentJobs(
  items: LibraryJobItem[] | null | undefined,
): LibraryJobItem[] {
  return dedupeLibraryCards(items);
}

export function isPrimaryRecentJob(item) {
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
}: any) {
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
    for (const item of items) {
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

    nextOffset += fetchLimit;

    if (pageHasMore === false || items.length < fetchLimit) {
      hasMore = false;
      break;
    }
    if (!hasMore || collected.length >= pageSize) {
      break;
    }
    if (collected.length === beforeCount || requestCount >= 12) {
      hasMore = false;
      break;
    }
  }

  return {
    collected,
    hasMore,
    latestInvocationSummary,
    nextOffset,
  };
}
