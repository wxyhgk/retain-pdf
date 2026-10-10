// 阅读书签：按书（和「记住阅读位置」同一个 scope：优先 document，没有才用 job）存在本机 localStorage。
// 重译换了 job，同一本书的书签还在。读写失败（隐私模式、存储满）一律当没有书签，不打断阅读。

export type ReaderBookmark = {
  page: number;
  /** 加书签时这一页所在的标题（没有就空），列表里用来认页。 */
  label: string;
  createdAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_PREFIX = "retainpdf:reader:bookmarks:v1:";
const MAX_BOOKMARKS = 200;

function defaultStorage(): StorageLike | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function keyOf(scope: string): string {
  const normalized = `${scope || ""}`.trim();
  return normalized ? `${STORAGE_PREFIX}${normalized}` : "";
}

function normalize(value: unknown): ReaderBookmark | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ReaderBookmark>;
  const page = Math.floor(Number(raw.page));
  if (!Number.isFinite(page) || page < 1) return null;
  return { page, label: `${raw.label || ""}`.trim().slice(0, 120), createdAt: `${raw.createdAt || ""}` };
}

/** 按页码从小到大，同一页只留一个。 */
export function readReaderBookmarks(scope: string, storage: StorageLike | null = defaultStorage()): ReaderBookmark[] {
  const key = keyOf(scope);
  if (!key || !storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(key) || "[]");
    const byPage = new Map<number, ReaderBookmark>();
    for (const item of Array.isArray(parsed) ? parsed : []) {
      const bookmark = normalize(item);
      if (bookmark && !byPage.has(bookmark.page)) byPage.set(bookmark.page, bookmark);
    }
    return [...byPage.values()].sort((a, b) => a.page - b.page);
  } catch {
    return [];
  }
}

function write(scope: string, bookmarks: ReaderBookmark[], storage: StorageLike | null): ReaderBookmark[] {
  const key = keyOf(scope);
  const sorted = [...bookmarks].sort((a, b) => a.page - b.page).slice(0, MAX_BOOKMARKS);
  if (!key || !storage) return sorted;
  try {
    storage.setItem(key, JSON.stringify(sorted));
  } catch {
    // 存不下就只在这次打开里有效。
  }
  return sorted;
}

/** 这一页有书签就去掉，没有就加上；返回新的列表。 */
export function toggleReaderBookmark(
  scope: string,
  page: number,
  label = "",
  { storage = defaultStorage(), now = () => new Date().toISOString() }: { storage?: StorageLike | null; now?: () => string } = {},
): ReaderBookmark[] {
  const current = readReaderBookmarks(scope, storage);
  const target = Math.floor(Number(page));
  if (!Number.isFinite(target) || target < 1) return current;
  if (current.some((bookmark) => bookmark.page === target)) {
    return write(scope, current.filter((bookmark) => bookmark.page !== target), storage);
  }
  return write(scope, [...current, { page: target, label: `${label || ""}`.trim().slice(0, 120), createdAt: now() }], storage);
}

export function removeReaderBookmark(scope: string, page: number, storage: StorageLike | null = defaultStorage()): ReaderBookmark[] {
  return write(scope, readReaderBookmarks(scope, storage).filter((bookmark) => bookmark.page !== page), storage);
}

type HeadingLike = {
  regionType?: string;
  source?: { page?: number; text?: string };
  translated?: { page?: number; text?: string };
  markdown?: string;
  readingOrder?: number;
};

/** 这一页所在的章节：本页或之前最近的一个标题（译文优先）。没有标题时返回空串。 */
export function bookmarkLabelForPage(regions: readonly HeadingLike[] | null | undefined, page: number): string {
  let best: { page: number; order: number; text: string } | null = null;
  for (const region of regions || []) {
    if (`${region?.regionType || ""}` !== "heading") continue;
    const regionPage = Number(region.source?.page ?? region.translated?.page);
    if (!Number.isFinite(regionPage) || regionPage > page) continue;
    const text = `${region.translated?.text || region.markdown || region.source?.text || ""}`.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const order = Number(region.readingOrder) || 0;
    if (!best || regionPage > best.page || (regionPage === best.page && order >= best.order)) {
      best = { page: regionPage, order, text };
    }
  }
  return best ? best.text.slice(0, 60) : "";
}
