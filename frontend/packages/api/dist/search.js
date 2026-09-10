// search — pure
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
export async function searchLibrary(apiPrefix, q, { limit = 20 } = {}) {
    const query = `${q || ""}`.trim();
    if (!query)
        return { hits: [] };
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("limit", `${limit}`);
    const resp = await fetch(`${buildApiEndpoint(apiPrefix, "search")}?${params.toString()}`, { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`检索失败，请稍后重试。(${resp.status})`);
    return unwrapEnvelope(await resp.json());
}
