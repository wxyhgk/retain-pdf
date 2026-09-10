// ai — canonical from frontend/web/src/js/api/ai.ts (mock removed, runtime adapted)
// Uses internal/runtime + http helpers.
import { API_PREFIX } from "./internal/runtime.js";
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
export class AiAskError extends Error {
    status;
    constructor(message, status = 0) {
        super(message);
        this.name = "AiAskError";
        this.status = status;
    }
}
function normalizeOperationRefs(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => {
        if (typeof item === "string")
            return !!item.trim();
        return !!item && typeof item === "object" && !!`${item.operation_id || ""}`.trim();
    });
}
function normalizeConfirmationMode(value) {
    return value === "explicit" || value === "green_light" ? value : "";
}
function normalizeConfirmationRequest(value) {
    if (!value || typeof value !== "object")
        return null;
    const request = value;
    const operationId = `${request.operation_id || ""}`.trim();
    const action = `${request.action || ""}`;
    const status = `${request.status || ""}`;
    const currentAttempt = Number(request.current_attempt);
    const latestEventSeq = Number(request.latest_event_seq);
    if (request.schema !== "retainpdf_agent_confirmation_v1"
        || !operationId
        || !["run", "commit", "retry"].includes(action)
        || !status
        || !Number.isFinite(currentAttempt)
        || !Number.isFinite(latestEventSeq)
        || currentAttempt < 1
        || latestEventSeq < 0)
        return null;
    return {
        schema: "retainpdf_agent_confirmation_v1",
        operation_id: operationId,
        action: action,
        status,
        current_attempt: currentAttempt,
        latest_event_seq: latestEventSeq,
        requires_risk_acceptance: request.requires_risk_acceptance === true,
    };
}
function normalizeConfirmationRequests(value) {
    if (!Array.isArray(value))
        return [];
    return value.map(normalizeConfirmationRequest).filter((item) => !!item);
}
function normalizeDonePayload(payload = {}) {
    return {
        answer: `${payload?.answer || ""}`,
        citations: Array.isArray(payload?.citations) ? payload.citations : [],
        toolTrace: Array.isArray(payload?.tool_trace) ? payload.tool_trace : [],
        rounds: Number(payload?.rounds) || 0,
        conversationId: `${payload?.conversation_id || payload?.conversationId || ""}`.trim(),
        agentRuntime: `${payload?.agent_runtime || payload?.["agentRuntime"] || ""}`.trim(),
        operationRefs: normalizeOperationRefs(payload?.operation_refs || payload?.["operationRefs"]),
        confirmationMode: normalizeConfirmationMode(payload?.confirmation_mode || payload?.["confirmationMode"]),
        confirmationRequests: normalizeConfirmationRequests(payload?.confirmation_requests || payload?.["confirmationRequests"]),
        persisted: payload?.persisted !== false,
    };
}
function parseSseEvent(line = "") {
    const trimmed = `${line}`.replace(/\r$/, "");
    if (!trimmed.startsWith("data:"))
        return null;
    const jsonText = trimmed.slice("data:".length).trim();
    if (!jsonText)
        return null;
    try {
        return JSON.parse(jsonText);
    }
    catch {
        return null;
    }
}
export async function readAiAskStream(body, { onProgressEvent = null, onToolEvent = null, onAgentToolEvent = null, onAgentOperationEvent = null, onAgentConfirmationRequiredEvent = null, onAgentSessionEvent = null, onAnswerDelta = null, onCompress = null, } = {}) {
    if (!body || typeof body.getReader !== "function")
        throw new AiAskError("AI 服务响应格式异常,请重试。");
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result = null;
    let streamedAnswer = "";
    let streamedAgentRuntime = "";
    const streamedOperationRefs = [];
    function handleLine(line) {
        const event = parseSseEvent(line);
        if (!event || typeof event !== "object")
            return;
        if (event.type === "progress") {
            onProgressEvent?.({
                type: "progress",
                stage: event.stage === "retrieval" ? "retrieval" : "routing",
                message: `${event.message || ""}`.trim(),
            });
            return;
        }
        if (event.type === "heartbeat")
            return;
        if (event.type === "tool") {
            onToolEvent?.(event);
            return;
        }
        if (event.type === "agent_tool") {
            onAgentToolEvent?.(event);
            onToolEvent?.(event);
            return;
        }
        if (event.type === "agent_session") {
            streamedAgentRuntime = `${event.agent_runtime || event.runtime || ""}`.trim();
            onAgentSessionEvent?.(event);
            return;
        }
        if (event.type === "agent_operation") {
            const operationId = `${event.operation_id || ""}`.trim();
            if (operationId) {
                const ref = {
                    operation_id: operationId,
                    ...(event.status ? { status: `${event.status}` } : {}),
                    ...(Number.isFinite(Number(event.current_attempt)) ? { current_attempt: Number(event.current_attempt) } : {}),
                    ...(Number.isFinite(Number(event.latest_event_seq)) ? { latest_event_seq: Number(event.latest_event_seq) } : {}),
                };
                const index = streamedOperationRefs.findIndex((item) => typeof item === "string" ? item === operationId : item.operation_id === operationId);
                if (index >= 0)
                    streamedOperationRefs[index] = ref;
                else
                    streamedOperationRefs.push(ref);
            }
            onAgentOperationEvent?.(event);
            return;
        }
        if (event.type === "agent_confirmation_required") {
            const confirmation = normalizeConfirmationRequest(event);
            if (confirmation) {
                onAgentConfirmationRequiredEvent?.({
                    type: "agent_confirmation_required",
                    ...confirmation,
                });
            }
            return;
        }
        if (event.type === "answer_delta") {
            const chunk = `${event.text || ""}`;
            if (chunk) {
                streamedAnswer += chunk;
                onAnswerDelta?.(streamedAnswer, chunk);
            }
            return;
        }
        if (event.type === "done") {
            result = normalizeDonePayload({
                ...event,
                answer: event.answer || streamedAnswer,
                agent_runtime: event.agent_runtime || streamedAgentRuntime,
                operation_refs: Array.isArray(event.operation_refs)
                    ? event.operation_refs
                    : Array.isArray(event.operationRefs)
                        ? event.operationRefs
                        : streamedOperationRefs,
            });
            for (const confirmation of result.confirmationRequests) {
                onAgentConfirmationRequiredEvent?.({
                    type: "agent_confirmation_required",
                    ...confirmation,
                });
            }
            return;
        }
        if (event.type === "error" || event.type === "cancelled") {
            throw new AiAskError(`${event.message || (event.type === "cancelled" ? "AI 请求已取消。" : "AI 服务返回错误。")}`);
        }
        if (event.type === "compress") {
            onCompress?.(event);
            return;
        }
    }
    try {
        while (!result) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            let newlineIndex = buffer.indexOf("\n");
            while (newlineIndex >= 0) {
                handleLine(buffer.slice(0, newlineIndex));
                buffer = buffer.slice(newlineIndex + 1);
                newlineIndex = buffer.indexOf("\n");
            }
        }
        if (!result) {
            buffer += decoder.decode();
            if (buffer.trim())
                handleLine(buffer);
        }
    }
    finally {
        reader.cancel?.().catch?.(() => { });
        reader.releaseLock?.();
    }
    if (!result)
        throw new AiAskError("AI 服务响应中断,请重试。");
    return result;
}
async function extractErrorMessage(resp) {
    const text = await resp.text().catch(() => "");
    try {
        const envelope = JSON.parse(text);
        const message = `${envelope?.message || ""}`.trim();
        if (message)
            return message;
        const detail = envelope?.detail;
        if (typeof detail === "string" && detail.trim())
            return detail.trim();
        if (Array.isArray(detail)) {
            const parts = detail.map((item) => {
                if (typeof item === "string")
                    return item.trim();
                if (item && typeof item === "object")
                    return `${item.msg || item.message || ""}`.trim();
                return "";
            }).filter(Boolean);
            if (parts.length)
                return parts.join("; ");
        }
        return "";
    }
    catch {
        return `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, 240);
    }
}
export async function askLibraryAi({ question = "", documentId = "", jobId = "", conversationId = "", parentId = "", regenerate = false, userMessageId = "", assistantMessageId = "", onToolEvent = null, onProgressEvent = null, onAgentToolEvent = null, onAgentOperationEvent = null, onAgentConfirmationRequiredEvent = null, onAgentSessionEvent = null, onAnswerDelta = null, onCompress = null, signal = null, apiPrefix = API_PREFIX, fetchImpl = fetch, llmApiKey = "", llmBaseUrl = "", llmModel = "", confirmDocumentOperation = false, assistantMode = "auto", } = {}) {
    const trimmed = `${question}`.trim();
    if (!trimmed)
        throw new AiAskError("请输入问题。", 400);
    const payload = { question: trimmed, stream: true };
    const normalizedDocumentId = `${documentId || ""}`.trim();
    const normalizedJobId = `${jobId || ""}`.trim();
    const normalizedConversationId = `${conversationId || ""}`.trim();
    if (normalizedDocumentId)
        payload.document_id = normalizedDocumentId;
    if (normalizedJobId)
        payload.job_id = normalizedJobId;
    if (normalizedConversationId)
        payload.conversation_id = normalizedConversationId;
    const normalizedParentId = `${parentId || ""}`.trim();
    if (normalizedParentId)
        payload.parent_id = normalizedParentId;
    if (regenerate)
        payload.regenerate = true;
    const uid = `${userMessageId || ""}`.trim();
    const aid = `${assistantMessageId || ""}`.trim();
    if (uid)
        payload.user_message_id = uid;
    if (aid)
        payload.assistant_message_id = aid;
    if (confirmDocumentOperation === true)
        payload.confirm_document_operation = true;
    if (assistantMode === "reading" || assistantMode === "operations") {
        payload.assistant_mode = assistantMode;
    }
    const key = `${llmApiKey || ""}`.trim();
    if (key)
        payload.llm_api_key = key.replace(/^Bearer\s+/i, "").trim();
    if (`${llmBaseUrl || ""}`.trim())
        payload.llm_base_url = `${llmBaseUrl}`.trim();
    if (`${llmModel || ""}`.trim())
        payload.llm_model = `${llmModel}`.trim();
    const resp = await fetchImpl(buildApiEndpoint(apiPrefix, "ai/ask"), {
        method: "POST",
        headers: buildApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
        signal: signal,
    });
    if (!resp.ok) {
        if (resp.status === 502)
            throw new AiAskError("AI 服务未运行(502),请先启动 retainpdf-ai 服务。", 502);
        const message = await extractErrorMessage(resp);
        if (resp.status === 401) {
            const hint = /X-API-Key|api key|invalid api key|Unauthorized/i.test(message) ? message : "服务鉴权失败：X-API-Key 无效或未配置（检查 runtime-config 的 xApiKey / 后端 auth 配置）。";
            throw new AiAskError(`${hint}(${resp.status})`, 401);
        }
        if (resp.status === 400 && /LLM|模型\s*API\s*Key|api key/i.test(message)) {
            throw new AiAskError(message.includes("凭据") || message.includes("设置") ? `${message}(${resp.status})` : `缺少模型 API Key：请到设置 → API 设置填写后再提问。(${resp.status})`, 400);
        }
        throw new AiAskError(`${message || "AI 问答请求失败,请稍后重试。"}(${resp.status})`, resp.status);
    }
    const contentType = `${resp.headers?.get?.("content-type") || ""}`.toLowerCase();
    if (contentType.includes("application/json")) {
        const result = normalizeDonePayload(unwrapEnvelope(await resp.json()));
        for (const confirmation of result.confirmationRequests) {
            onAgentConfirmationRequiredEvent?.({
                type: "agent_confirmation_required",
                ...confirmation,
            });
        }
        return result;
    }
    return readAiAskStream(resp.body, {
        onProgressEvent,
        onToolEvent,
        onAgentToolEvent,
        onAgentOperationEvent,
        onAgentConfirmationRequiredEvent,
        onAgentSessionEvent,
        onAnswerDelta,
        onCompress,
    });
}
