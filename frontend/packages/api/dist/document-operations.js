import { API_PREFIX, buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
export class AgentOperationError extends Error {
    status;
    constructor(message, status = 0) {
        super(message);
        this.name = "AgentOperationError";
        this.status = status;
    }
}
function requiredId(value, field) {
    const normalized = `${value || ""}`.trim();
    if (!normalized)
        throw new AgentOperationError(`${field} required`, 400);
    return normalized;
}
async function extractErrorMessage(resp) {
    const text = await resp.text().catch(() => "");
    try {
        const payload = JSON.parse(text);
        return `${payload?.message || payload?.detail || ""}`.trim();
    }
    catch {
        return `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, 240);
    }
}
async function requestAgentOperation(path, init, options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const resp = await fetchImpl(buildApiEndpoint(options.apiPrefix || API_PREFIX, path), {
        ...init,
        headers: buildApiHeaders({
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...init.headers,
        }),
        signal: options.signal,
    });
    if (!resp.ok) {
        const message = await extractErrorMessage(resp);
        throw new AgentOperationError(`${message || "Agent operation request failed."}(${resp.status})`, resp.status);
    }
    if (resp.status === 204)
        return { ok: true };
    return unwrapEnvelope(await resp.json());
}
function operationPath(operationId, action = "") {
    const id = requiredId(operationId, "operation_id");
    return `ai/operations/${encodeURIComponent(id)}${action ? `/${action}` : ""}`;
}
export async function listAgentOperations({ conversationId, limit, apiPrefix = API_PREFIX, fetchImpl = fetch, signal = null, }) {
    const conversation = requiredId(conversationId, "conversation_id");
    const params = new URLSearchParams();
    if (limit != null)
        params.set("limit", String(limit));
    const suffix = params.toString();
    const payload = await requestAgentOperation(`ai/conversations/${encodeURIComponent(conversation)}/operations${suffix ? `?${suffix}` : ""}`, { method: "GET" }, { apiPrefix, fetchImpl, signal });
    if (Array.isArray(payload))
        return { operations: payload };
    return {
        ...payload,
        operations: Array.isArray(payload?.operations)
            ? payload.operations
            : Array.isArray(payload?.items)
                ? payload.items
                : [],
    };
}
export async function getAgentOperation(operationId, options = {}) {
    return requestAgentOperation(operationPath(operationId), { method: "GET" }, options);
}
export async function runAgentOperation(operationId, input, options = {}) {
    return requestAgentOperation(operationPath(operationId, "run"), {
        method: "POST",
        body: JSON.stringify({ ...input, schema: "document_operation_action_v1" }),
    }, options);
}
export async function cancelAgentOperation(operationId, input, options = {}) {
    return requestAgentOperation(operationPath(operationId, "cancel"), {
        method: "POST",
        body: JSON.stringify({ ...input, schema: "document_operation_action_v1" }),
    }, options);
}
export async function commitAgentOperation(operationId, input, options = {}) {
    return requestAgentOperation(operationPath(operationId, "commit"), {
        method: "POST",
        body: JSON.stringify({ ...input, schema: "document_operation_action_v1" }),
    }, options);
}
export async function retryAgentOperation(operationId, input, options = {}) {
    return requestAgentOperation(operationPath(operationId, "retry"), {
        method: "POST",
        body: JSON.stringify({ ...input, schema: "document_operation_action_v1" }),
    }, options);
}
export async function fetchAgentOperationCandidate(operationId, options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const url = buildAgentOperationCandidateUrl(operationId, options.apiPrefix || API_PREFIX);
    const response = await fetchImpl(url, {
        method: "GET",
        headers: buildApiHeaders(),
        signal: options.signal,
    });
    if (!response.ok) {
        const message = await extractErrorMessage(response);
        throw new AgentOperationError(`${message || "Agent candidate download failed."}(${response.status})`, response.status);
    }
    return response.blob();
}
export function buildAgentOperationCandidateUrl(operationId, apiPrefix = API_PREFIX) {
    return buildApiEndpoint(apiPrefix, `${operationPath(operationId)}/candidate.pdf`);
}
