import { normalizeJobImageUrl } from "@retainpdf/api/job-images";
// 走网关而不是 @retainpdf/api 的 fetchJobImageBlob：后者用裸 fetch，
// 拿不到 mock 分流，演示模式下 mock:// 封面必然 404。网关的 fetchProtected
// 在非 mock 模式下就是 canonical 的同名实现（同样 buildApiHeaders + fetch），
// 真实模式行为不变。
import { fetchProtected } from "@/platform/api/index.js";

const recentJobImageCache = new Map();

function cacheKeyForRecentJobImage(url, { cacheVersion = "" } = {}) {
  const version = `${cacheVersion || ""}`.trim();
  return version ? `${url}#${version}` : url;
}

export function normalizeRecentJobImageUrl(value) {
  return normalizeJobImageUrl(value);
}

export function clearRecentJobImageCache(rawUrls) {
  for (const rawUrl of Array.isArray(rawUrls) ? rawUrls : [rawUrls]) {
    const url = normalizeRecentJobImageUrl(rawUrl);
    if (url) {
      recentJobImageCache.delete(url);
    }
  }
}

export async function loadRecentJobImage(rawUrl, options = {}) {
  const url = normalizeRecentJobImageUrl(rawUrl);
  if (!url) {
    return "";
  }
  const cacheKey = cacheKeyForRecentJobImage(url, options);
  if (recentJobImageCache.has(cacheKey)) {
    return recentJobImageCache.get(cacheKey);
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

export async function loadFirstRecentJobImage(rawUrls, options = {}) {
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
