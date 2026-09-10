export interface LibraryCardLike {
  document_id?: string;
  job_id?: string;
  active_job_id?: string;
  source_job_id?: string;
}

function normalizedIdentityPart(value: unknown): string {
  return `${value || ""}`.trim();
}

function documentIdentity(value: unknown): string {
  const documentId = normalizedIdentityPart(value);
  return documentId ? `document:${documentId}` : "";
}

function jobIdentity(value: unknown): string {
  const jobId = normalizedIdentityPart(value);
  return jobId ? `job:${jobId}` : "";
}

/** Stable identity for a library card. A document survives retry-created job ids. */
export function libraryCardIdentity(item: LibraryCardLike | null | undefined): string {
  return documentIdentity(item?.document_id) || jobIdentity(item?.job_id);
}

/**
 * Matching aliases are deliberately wider than the stable identity so the first
 * retry frame can replace its source card before the backend supplies document_id.
 */
export function libraryCardIdentityAliases(
  item: LibraryCardLike | null | undefined,
): string[] {
  const aliases = [
    libraryCardIdentity(item),
    jobIdentity(item?.job_id),
    jobIdentity(item?.active_job_id),
    jobIdentity(item?.source_job_id),
  ].filter(Boolean);
  return Array.from(new Set(aliases));
}

export function sameLibraryCard(
  left: LibraryCardLike | null | undefined,
  right: LibraryCardLike | null | undefined,
): boolean {
  const leftDocumentId = normalizedIdentityPart(left?.document_id);
  const rightDocumentId = normalizedIdentityPart(right?.document_id);
  if (leftDocumentId && rightDocumentId) {
    return leftDocumentId === rightDocumentId;
  }

  const rightAliases = new Set(libraryCardIdentityAliases(right));
  return libraryCardIdentityAliases(left).some((identity) => rightAliases.has(identity));
}

export function findLibraryCardIndex<T extends LibraryCardLike>(
  items: T[] | null | undefined,
  candidate: LibraryCardLike | null | undefined,
): number {
  if (!libraryCardIdentity(candidate) && libraryCardIdentityAliases(candidate).length === 0) {
    return -1;
  }
  return (Array.isArray(items) ? items : []).findIndex((item) => sameLibraryCard(item, candidate));
}

export function dedupeLibraryCards<T extends LibraryCardLike>(
  items: T[] | null | undefined,
): T[] {
  const result: T[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!libraryCardIdentity(item) || findLibraryCardIndex(result, item) >= 0) {
      continue;
    }
    result.push(item);
  }
  return result;
}

export function replaceLibraryCard<T extends LibraryCardLike>(
  items: T[] | null | undefined,
  candidate: T,
): T[] {
  const list = Array.isArray(items) ? items : [];
  const index = findLibraryCardIndex(list, candidate);
  if (index < 0) {
    return list;
  }
  return dedupeLibraryCards(list.map((item, itemIndex) => (
    itemIndex === index ? candidate : item
  )));
}

export function upsertLibraryCard<T extends LibraryCardLike>(
  items: T[] | null | undefined,
  candidate: T,
  { prepend = true }: { prepend?: boolean } = {},
): T[] {
  const list = Array.isArray(items) ? items : [];
  const index = findLibraryCardIndex(list, candidate);
  if (index < 0) {
    return dedupeLibraryCards(prepend ? [candidate, ...list] : [...list, candidate]);
  }
  return dedupeLibraryCards(list.map((item, itemIndex) => (
    itemIndex === index ? candidate : item
  )));
}
