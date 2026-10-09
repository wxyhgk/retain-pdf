import { APP_VERSION } from "@/platform/generated/app-version.js";
import { UPDATE_CHECK_CACHE_STORAGE_KEY as CACHE_KEY } from "@/platform/config/storage-keys.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 缓存条目：normalizeReleaseInfo 的字段加上检查时间戳（读出与写入共用同一形状）。 */
export type CachedUpdateInfo = {
  checkedAt: number;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  title: string;
  body: string;
  htmlUrl: string;
  publishedAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** JSON 解析出的字段只有字符串才采用，其余视为缺失。 */
function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeCachedInfo(value: unknown): CachedUpdateInfo | null {
  if (!isObject(value)) {
    return null;
  }
  const checkedAt = Number(value.checkedAt);
  const latestVersion = textOf(value.latestVersion).trim();
  if (!Number.isFinite(checkedAt) || !latestVersion) {
    return null;
  }
  return {
    checkedAt,
    currentVersion: textOf(value.currentVersion) || APP_VERSION,
    latestVersion,
    hasUpdate: Boolean(value.hasUpdate),
    title: textOf(value.title) || latestVersion,
    body: textOf(value.body),
    htmlUrl: textOf(value.htmlUrl),
    publishedAt: textOf(value.publishedAt),
  };
}

export function createUpdateCachePort({
  storage = globalThis.window?.localStorage,
  now = () => Date.now(),
}: {
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  now?: () => number;
} = {}) {
  function read() {
    try {
      const cached = normalizeCachedInfo(JSON.parse(storage?.getItem(CACHE_KEY) || "null"));
      if (!cached) {
        return { info: null, fresh: false };
      }
      const ageMs = now() - cached.checkedAt;
      return {
        info: cached,
        fresh: ageMs >= 0 && ageMs < CACHE_TTL_MS,
      };
    } catch {
      return { info: null, fresh: false };
    }
  }

  // 参数取 unknown：装配层的端口类型是 (info: unknown) => void，这里在入口收窄。
  function write(info: unknown) {
    if (!isObject(info)) {
      return;
    }
    try {
      const cached = {
        checkedAt: now(),
        currentVersion: textOf(info.currentVersion) || APP_VERSION,
        latestVersion: textOf(info.latestVersion),
        hasUpdate: Boolean(info.hasUpdate),
        title: textOf(info.title),
        body: textOf(info.body),
        htmlUrl: textOf(info.htmlUrl),
        publishedAt: textOf(info.publishedAt),
      };
      storage?.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch {
      // Cache failures should never affect update checks.
    }
  }

  return Object.freeze({
    read,
    write,
  });
}

export const defaultUpdateCachePort = createUpdateCachePort();

export function readUpdateCache(now = Date.now()) {
  return createUpdateCachePort({ now: () => now }).read();
}

export function writeUpdateCache(info: unknown, now = Date.now()) {
  createUpdateCachePort({ now: () => now }).write(info);
}
