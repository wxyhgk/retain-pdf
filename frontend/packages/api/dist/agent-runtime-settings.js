import { API_PREFIX, buildApiHeaders, buildApiUrl, unwrapEnvelope, } from "./internal/runtime.js";
async function responseError(response) {
    let message = "AI Agent 配置请求失败";
    try {
        const payload = await response.json();
        message = `${payload?.detail || payload?.message || message}`;
    }
    catch {
        // Keep the safe fallback; never include a request payload or credential.
    }
    return new Error(`${message} (${response.status})`);
}
export async function fetchAgentRuntimeConfig({ apiPrefix = API_PREFIX, fetchImpl = fetch, } = {}) {
    const response = await fetchImpl(buildApiUrl(apiPrefix, "ai/runtime-config"), {
        method: "GET",
        headers: buildApiHeaders(),
        cache: "no-store",
    });
    if (!response.ok)
        throw await responseError(response);
    return unwrapEnvelope(await response.json());
}
export async function updateAgentRuntimeConfig(update, { apiPrefix = API_PREFIX, fetchImpl = fetch, } = {}) {
    const response = await fetchImpl(buildApiUrl(apiPrefix, "ai/runtime-config"), {
        method: "PUT",
        headers: buildApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(update),
    });
    if (!response.ok)
        throw await responseError(response);
    return unwrapEnvelope(await response.json());
}
