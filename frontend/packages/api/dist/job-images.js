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
// 只用后端给的地址：书架和文档列表现在给同一本书同一个地址（/documents/:id/thumbnail|cover），
// 不再自己拼 jobs/… 和 library/books/… 的备选——以前同一本书两条地址各下一份，首页 41 本书拉了 82 张图。
// apiPrefix 参数保留给老调用方，不再使用。
export function buildJobImageCandidateUrls(item = {}, _options = {}) {
    return dedupe([item?.thumbnail_url, item?.cover_url]);
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
