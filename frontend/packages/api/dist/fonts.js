// frontend/packages/api/src/fonts.ts — font discovery (GET /api/v1/fonts)
import { apiFetch } from "./internal/runtime.js";
import { API_PREFIX, buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
export async function listFonts(apiPrefix = API_PREFIX) {
    const endpoint = buildApiEndpoint(apiPrefix, "fonts");
    const resp = await apiFetch(endpoint, { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取字体列表失败，请稍后重试。(${resp.status})`);
    const data = unwrapEnvelope(await resp.json());
    if (Array.isArray(data))
        return data;
    if (data && Array.isArray(data.fonts))
        return data.fonts;
    return [];
}
