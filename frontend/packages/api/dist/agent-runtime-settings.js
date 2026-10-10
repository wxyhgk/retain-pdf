import { apiFetch } from "./internal/runtime.js";
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
function parseRuntimeConfig(payload) {
    // Python AI returns { data: view }; Rust clients may use { code: 0, data: view }.
    // Keep this compatibility local to this endpoint, not the generic envelope parser.
    const unwrapped = unwrapEnvelope(payload);
    const view = unwrapped?.schema === "retainpdf_ai_runtime_config_view_v1"
        ? unwrapped
        : unwrapped?.data;
    if (view?.schema !== "retainpdf_ai_runtime_config_view_v1") {
        throw new Error("AI Agent 配置返回格式不正确");
    }
    return view;
}
export async function fetchAgentRuntimeConfig({ apiPrefix = API_PREFIX, fetchImpl = apiFetch, } = {}) {
    const response = await fetchImpl(buildApiUrl(apiPrefix, "ai/runtime-config"), {
        method: "GET",
        headers: buildApiHeaders(),
        cache: "no-store",
    });
    if (!response.ok)
        throw await responseError(response);
    return parseRuntimeConfig(await response.json());
}
export async function updateAgentRuntimeConfig(update, { apiPrefix = API_PREFIX, fetchImpl = apiFetch, } = {}) {
    const response = await fetchImpl(buildApiUrl(apiPrefix, "ai/runtime-config"), {
        method: "PUT",
        headers: buildApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(update),
    });
    if (!response.ok)
        throw await responseError(response);
    return parseRuntimeConfig(await response.json());
}
