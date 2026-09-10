// frontend/packages/api/src/fonts.ts — font discovery + upload (GET /api/v1/fonts)
import { API_PREFIX, buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
export async function listFonts(apiPrefix = API_PREFIX) {
    const endpoint = buildApiEndpoint(apiPrefix, "fonts");
    const resp = await fetch(endpoint, { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取字体列表失败，请稍后重试。(${resp.status})`);
    const data = unwrapEnvelope(await resp.json());
    if (Array.isArray(data))
        return data;
    if (data && Array.isArray(data.fonts))
        return data.fonts;
    return [];
}
export async function uploadFont(apiPrefix = API_PREFIX, file, fileName) {
    const endpoint = buildApiEndpoint(apiPrefix, "fonts/upload");
    const form = new FormData();
    const name = fileName || file.name || "upload.otf";
    form.append("file", file, name);
    // For multipart we must NOT set Content-Type; fetch will set boundary automatically.
    // buildApiHeaders adds Content-Type: application/json by default, so strip it.
    const headers = buildApiHeaders();
    delete headers["Content-Type"];
    const resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: form,
    });
    if (!resp.ok) {
        const text = await resp.text();
        let message = text;
        try {
            const parsed = JSON.parse(text);
            message = parsed?.message || text;
        }
        catch { }
        throw new Error(`上传字体失败: ${resp.status} ${message}`);
    }
    const json = await resp.json();
    return unwrapEnvelope(json);
}
// Convenience overload: uploadFont(file) without prefix
export async function uploadFontFile(file, fileName) {
    return uploadFont(API_PREFIX, file, fileName);
}
