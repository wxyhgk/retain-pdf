import { APP_VERSION } from "@/platform/generated/app-version.js";

const CACHE_KEY = "retainpdf:update-check:v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeCachedInfo(value) {
  if (!isObject(value)) {
    return null;
  }
  const checkedAt = Number(value.checkedAt);
  const latestVersion = `${value.latestVersion || ""}`.trim();
  if (!Number.isFinite(checkedAt) || !latestVersion) {
    return null;
  }
  return {
    checkedAt,
    currentVersion: value.currentVersion || APP_VERSION,
    latestVersion,
    hasUpdate: Boolean(value.hasUpdate),
    title: value.title || latestVersion,
    body: value.body || "",
    htmlUrl: value.htmlUrl || "",
    publishedAt: value.publishedAt || "",
  };
}

export function createUpdateCachePort({
  storage = globalThis.window?.localStorage,
  now = () => Date.now(),
}: any = {}) {
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

  function write(info) {
    if (!info) {
      return;
    }
    try {
      const cached = {
        checkedAt: now(),
        currentVersion: info.currentVersion || APP_VERSION,
        latestVersion: info.latestVersion || "",
        hasUpdate: Boolean(info.hasUpdate),
        title: info.title || "",
        body: info.body || "",
        htmlUrl: info.htmlUrl || "",
        publishedAt: info.publishedAt || "",
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

export function writeUpdateCache(info, now = Date.now()) {
  createUpdateCachePort({ now: () => now }).write(info);
}
