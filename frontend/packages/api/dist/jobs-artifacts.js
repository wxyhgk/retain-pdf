// jobs-artifacts — pure (no mock)
import { apiFetch } from "./internal/runtime.js";
import { API_PREFIX, buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildJobDetailEndpoint } from "./http.js";
/**
 * Read the stable, public artifact projection used by the Reader.
 * The detailed manifest is intentionally a separate endpoint and can be empty
 * for older completed jobs even when published downloads are available.
 */
export async function fetchJobArtifacts(jobId, apiPrefix = API_PREFIX) {
    const resp = await apiFetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/artifacts`, { headers: buildApiHeaders() });
    if (resp.ok)
        return unwrapEnvelope(await resp.json());
    if (resp.status === 404)
        return null;
    throw new Error(`读取任务产物失败，请稍后重试。(${resp.status})`);
}
export async function fetchJobArtifactsManifest(jobId, apiPrefix = API_PREFIX) {
    const resp = await apiFetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/artifacts-manifest`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404)
            return { items: [] };
        throw new Error(`读取产物清单失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function fetchJobMarkdown(jobId, apiPrefix = API_PREFIX) {
    const resp = await apiFetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/markdown`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404)
            return null;
        throw new Error(`读取 Markdown 失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function fetchJobMarkdownDocument(jobId, apiPrefix = API_PREFIX) {
    const resp = await apiFetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/markdown/document`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404)
            return null;
        throw new Error(`读取结构化 Markdown 失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
