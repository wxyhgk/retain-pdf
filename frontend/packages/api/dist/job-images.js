// job-images — pure (from frontend/web/src/js/api/job-images.ts, mock removed)
// Builds candidate URLs for thumbnail/cover fallbacks and fetches image blobs.
import { API_PREFIX, buildApiHeaders, buildApiUrl } from "./internal/runtime.js";
function isFileProtocolRuntime() {
    return typeof window !== "undefined" && window.location?.protocol === "file:";
}
function dedupe(values) {
    const urls = [];
    for (const value of values) {
        const url = `${value || ""}`.trim();
        if (url && !urls.includes(url))
            urls.push(url);
    }
    return urls;
}
function apiPath(apiPrefix, relativePath) {
    const prefix = `${apiPrefix || API_PREFIX}`.trim().replace(/\/+$/, "");
    const path = `${relativePath || ""}`.trim().replace(/^\/+/, "");
    return `${prefix}/${path}`;
}
function artifactReady(item, ...keys) {
    const artifacts = item?.artifacts && typeof item.artifacts === "object" ? item.artifacts : {};
    const displayItems = Array.isArray(item?.artifacts_display) ? item.artifacts_display : [];
    return keys.some((key) => Boolean(item?.[`${key}_ready`] || artifacts?.[key]?.ready || artifacts?.[`${key}_ready`] || displayItems.some((d) => d?.ready && (d?.key === key || d?.kind === key))));
}
export function buildJobImageCandidateUrls(item = {}, { apiPrefix = API_PREFIX } = {}) {
    const jobId = `${item?.job_id || item?.id || ""}`.trim();
    const urls = [item?.thumbnail_url, item?.cover_url];
    if (jobId) {
        const encodedJobId = encodeURIComponent(jobId);
        if (artifactReady(item, "thumbnail"))
            urls.push(apiPath(apiPrefix, `jobs/${encodedJobId}/thumbnail`), apiPath(apiPrefix, `library/books/${encodedJobId}/thumbnail`));
        if (artifactReady(item, "cover"))
            urls.push(apiPath(apiPrefix, `jobs/${encodedJobId}/cover`), apiPath(apiPrefix, `library/books/${encodedJobId}/cover`));
    }
    return dedupe(urls);
}
export function normalizeJobImageUrl(value) {
    const raw = `${value || ""}`.trim();
    if (!raw)
        return "";
    // mock:// 是 mock 夹具自带的协议（见 web 侧 platform/mock/responses.ts 的
    // fetchMockProtected）。它既不是 http(s)、也不以 API_PREFIX 开头，会掉到
    // 最后那条「当相对路径拼到 apiBase 上」的分支，变成
    // http://127.0.0.1:41000/mock://document-cover.png → 404，
    // 演示模式下书架封面因此空白。协议 URL 原样返回，交给调用方分流。
    if (/^mock:\/\//i.test(raw))
        return raw;
    if (/^https?:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw);
            if (parsed.pathname.startsWith(`${API_PREFIX}/`)) {
                const path = `${parsed.pathname}${parsed.search}`;
                return buildApiUrl("", path.replace(/^\/+/, ""));
            }
        }
        catch {
            return raw;
        }
        return raw;
    }
    if (raw.startsWith(`${API_PREFIX}/`))
        return isFileProtocolRuntime() ? buildApiUrl("", raw.replace(/^\/+/, "")) : raw;
    return buildApiUrl("", raw.replace(/^\/+/, ""));
}
export async function fetchJobImageBlob(rawUrl) {
    const url = normalizeJobImageUrl(rawUrl);
    if (!url)
        return null;
    const response = await fetch(url, { headers: buildApiHeaders() });
    if (!response.ok)
        throw new Error(`image failed: ${response.status}`);
    return response.blob();
}
