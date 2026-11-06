import { normalizeJobImageUrl } from "@retainpdf/api/job-images";
// 走网关而不是 @retainpdf/api 的 fetchJobImageBlob：后者用裸 fetch，
// 拿不到 mock 分流，演示模式下 mock:// 封面必然 404。网关的 fetchProtected
// 在非 mock 模式下就是 canonical 的同名实现（同样 buildApiHeaders + fetch），
// 真实模式行为不变。
import { fetchProtected } from "@/platform/api/index.js";

const recentJobImageCache = new Map<string, Promise<string>>();

type RecentJobImageOptions = { cacheVersion?: string };

function cacheKeyForRecentJobImage(url: string, { cacheVersion = "" }: RecentJobImageOptions = {}) {
  const version = `${cacheVersion || ""}`.trim();
  return version ? `${url}#${version}` : url;
}

export function normalizeRecentJobImageUrl(value: unknown) {
  return normalizeJobImageUrl(value);
}

export function clearRecentJobImageCache(rawUrls: unknown) {
  for (const rawUrl of Array.isArray(rawUrls) ? rawUrls : [rawUrls]) {
    const url = normalizeRecentJobImageUrl(rawUrl);
    if (url) {
      recentJobImageCache.delete(url);
    }
  }
}

export async function loadRecentJobImage(rawUrl: unknown, options: RecentJobImageOptions = {}): Promise<string> {
  const url = normalizeRecentJobImageUrl(rawUrl);
  if (!url) {
    return "";
  }
  const cacheKey = cacheKeyForRecentJobImage(url, options);
  const cached = recentJobImageCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  // 先按「还不知道版本」（书单先到、任务状态还没合进来）下过的那张，版本头一回定下来时直接认领，不再重下：
  // 以前书库第一页每张封面都下两遍（书单一遍、任务状态到了又一遍），书一多，打开书库时成倍的请求和解码。
  // 认领过以后版本再变（重跑完成换了成品封面）照旧重下。
  const unversioned = cacheKey === url ? undefined : recentJobImageCache.get(url);
  if (unversioned) {
    recentJobImageCache.set(cacheKey, unversioned);
    recentJobImageCache.delete(url);
    return unversioned;
  }
  const request = fetchProtected(url)
    .then((response) => {
      if (!response.ok) throw new Error(`image failed: ${response.status}`);
      return response.blob();
    })
    .then((blob) => URL.createObjectURL(blob))
    .catch((error) => {
      recentJobImageCache.delete(cacheKey);
      throw error;
    });
  recentJobImageCache.set(cacheKey, request);
  return request;
}

export async function loadFirstRecentJobImage(rawUrls: unknown, options: RecentJobImageOptions = {}) {
  for (const rawUrl of Array.isArray(rawUrls) ? rawUrls : [rawUrls]) {
    try {
      const objectUrl = await loadRecentJobImage(rawUrl, options);
      if (objectUrl) {
        return objectUrl;
      }
    } catch {
      // Try the next candidate URL.
    }
  }
  return "";
}
