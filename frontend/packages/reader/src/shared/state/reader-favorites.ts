// 收藏的段落（2026-11-28 用户：划词「复制 + 收藏 + 提问」闭环）：书页上选一段字收起来，左下角「收藏」（星）里列着，点了翻回去。
// 和书签同一个 scope（优先 document，没有才用 job；reader-bookmarks.ts），存在本机 localStorage；读写失败当没有，不打断阅读。

export type ReaderFavorite = {
  id: string;
  /** 选的那段字（已经收拾过断行、连字符，selection-text.ts）。 */
  text: string;
  page: number;
  pane: "source" | "translated";
  createdAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_PREFIX = "retainpdf:reader:favorites:v1:";
const MAX_FAVORITES = 500;
/** 一条最多存这么多字（整页整章地选也只存开头）。 */
export const FAVORITE_TEXT_LIMIT = 2000;

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

function normalize(value: unknown): ReaderFavorite | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ReaderFavorite>;
  const page = Math.floor(Number(raw.page));
  const text = `${raw.text || ""}`.trim().slice(0, FAVORITE_TEXT_LIMIT);
  const id = `${raw.id || ""}`.trim();
  if (!id || !text || !Number.isFinite(page) || page < 1) return null;
  return { id, text, page, pane: raw.pane === "translated" ? "translated" : "source", createdAt: `${raw.createdAt || ""}` };
}

/** 新收的在前。 */
export function readReaderFavorites(scope: string, storage: StorageLike | null = defaultStorage()): ReaderFavorite[] {
  const key = keyOf(scope);
  if (!key || !storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(key) || "[]");
    const seen = new Set<string>();
    const out: ReaderFavorite[] = [];
    for (const item of Array.isArray(parsed) ? parsed : []) {
      const favorite = normalize(item);
      if (favorite && !seen.has(favorite.id)) {
        seen.add(favorite.id);
        out.push(favorite);
      }
    }
    return out;
  } catch {
    return [];
  }
}

const listeners = new Set<(scope: string) => void>();

/** 这本书的收藏变了就调 listener（浮条、右键收了一段，左下角的列表跟着变）；返回取消订阅。 */
export function subscribeReaderFavorites(scope: string, listener: () => void): () => void {
  const wrapped = (changed: string) => { if (changed === scope) listener(); };
  listeners.add(wrapped);
  return () => { listeners.delete(wrapped); };
}

function write(scope: string, favorites: ReaderFavorite[], storage: StorageLike | null): ReaderFavorite[] {
  const key = keyOf(scope);
  const kept = favorites.slice(0, MAX_FAVORITES);
  if (key && storage) {
    try {
      storage.setItem(key, JSON.stringify(kept));
    } catch {
      // 存不下就只在这次打开里有效。
    }
  }
  for (const listener of [...listeners]) listener(scope);
  return kept;
}

/** 同一页同一段字收过就不再收一份（返回已有的那条）。 */
export function findReaderFavorite(favorites: readonly ReaderFavorite[], text: string, page: number): ReaderFavorite | null {
  const target = `${text || ""}`.trim().slice(0, FAVORITE_TEXT_LIMIT);
  return favorites.find((favorite) => favorite.page === page && favorite.text === target) ?? null;
}

export function addReaderFavorite(
  scope: string,
  entry: { text: string; page: number; pane: "source" | "translated" },
  { storage = defaultStorage(), now = () => new Date().toISOString(), makeId = randomId }: { storage?: StorageLike | null; now?: () => string; makeId?: () => string } = {},
): ReaderFavorite[] {
  const current = readReaderFavorites(scope, storage);
  const text = `${entry.text || ""}`.trim().slice(0, FAVORITE_TEXT_LIMIT);
  const page = Math.floor(Number(entry.page));
  if (!text || !Number.isFinite(page) || page < 1 || findReaderFavorite(current, text, page)) return current;
  return write(scope, [{ id: makeId(), text, page, pane: entry.pane === "translated" ? "translated" : "source", createdAt: now() }, ...current], storage);
}

export function removeReaderFavorite(scope: string, id: string, storage: StorageLike | null = defaultStorage()): ReaderFavorite[] {
  return write(scope, readReaderFavorites(scope, storage).filter((favorite) => favorite.id !== id), storage);
}

function randomId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // 非安全上下文没有 randomUUID
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
