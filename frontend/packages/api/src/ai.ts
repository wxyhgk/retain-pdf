// ai — canonical from frontend/web/src/js/api/ai.ts (mock removed, runtime adapted)
// Uses internal/runtime + http helpers.

import { API_PREFIX } from "./internal/runtime.js";
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
import type { AgentConfirmationMode } from "./agent-runtime-settings.js";
import type { AgentOperationStatus } from "./document-operations.js";

export type { AgentConfirmationMode } from "./agent-runtime-settings.js";

export class AiAskError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "AiAskError";
    this.status = status;
  }
}

export type AiAssistantMode = "auto" | "reading" | "operations";

export type AgentOperationRef =
  | string
  | {
      operation_id: string;
      status?: string;
      current_attempt?: number;
      latest_event_seq?: number;
    };

export type AgentToolEvent = {
  type: "agent_tool";
  runtime?: string;
  [key: string]: unknown;
};

export type AgentSessionEvent = {
  type: "agent_session";
  conversation_id: string;
  request_message_id?: string;
  agent_runtime: string;
  assistant_mode: AiAssistantMode;
  resolved_mode: "reading" | "operations";
  content_source: "structured" | "markdown" | "none" | "unscoped" | "unknown";
  capabilities?: {
    document_operations?: boolean;
    document_operation_confirmation_mode?: AgentConfirmationMode;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type AgentOperationEvent = {
  type: "agent_operation";
  event_id?: string;
  operation_id: string;
  conversation_id?: string;
  request_message_id?: string;
  status?: string;
  current_attempt?: number;
  latest_event_seq?: number;
  [key: string]: unknown;
};

export type AgentConfirmationRequest = {
  schema: "retainpdf_agent_confirmation_v1";
  operation_id: string;
  action: "run" | "commit" | "retry";
  status: AgentOperationStatus;
  current_attempt: number;
  latest_event_seq: number;
  requires_risk_acceptance: boolean;
};

export type AgentConfirmationRequiredEvent = AgentConfirmationRequest & {
  type: "agent_confirmation_required";
};

export type AiAskStreamCallbacks = {
  onProgressEvent?: ((event: { type: "progress"; stage: "routing" | "retrieval"; message: string }) => void) | null;
  onToolEvent?: ((event: any) => void) | null;
  onAgentToolEvent?: ((event: AgentToolEvent) => void) | null;
  onAgentOperationEvent?: ((event: AgentOperationEvent) => void) | null;
  onAgentConfirmationRequiredEvent?: ((event: AgentConfirmationRequiredEvent) => void) | null;
  onAgentSessionEvent?: ((event: AgentSessionEvent) => void) | null;
  onAnswerDelta?: ((full: string, chunk: string) => void) | null;
  onCompress?: ((event: any) => void) | null;
};

function normalizeOperationRefs(value: unknown): AgentOperationRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AgentOperationRef => {
    if (typeof item === "string") return !!item.trim();
    return !!item && typeof item === "object" && !!`${(item as any).operation_id || ""}`.trim();
  });
}

function normalizeConfirmationMode(value: unknown): AgentConfirmationMode | "" {
  return value === "explicit" || value === "green_light" ? value : "";
}

function normalizeConfirmationRequest(value: unknown): AgentConfirmationRequest | null {
  if (!value || typeof value !== "object") return null;
  const request = value as Record<string, unknown>;
  const operationId = `${request.operation_id || ""}`.trim();
  const action = `${request.action || ""}`;
  const status = `${request.status || ""}` as AgentOperationStatus;
  const currentAttempt = Number(request.current_attempt);
  const latestEventSeq = Number(request.latest_event_seq);
  if (
    request.schema !== "retainpdf_agent_confirmation_v1"
    || !operationId
    || !["run", "commit", "retry"].includes(action)
    || !status
    || !Number.isFinite(currentAttempt)
    || !Number.isFinite(latestEventSeq)
    || currentAttempt < 1
    || latestEventSeq < 0
  ) return null;
  return {
    schema: "retainpdf_agent_confirmation_v1",
    operation_id: operationId,
    action: action as AgentConfirmationRequest["action"],
    status,
    current_attempt: currentAttempt,
    latest_event_seq: latestEventSeq,
    requires_risk_acceptance: request.requires_risk_acceptance === true,
  };
}

function normalizeConfirmationRequests(value: unknown): AgentConfirmationRequest[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeConfirmationRequest).filter((item): item is AgentConfirmationRequest => !!item);
}

function normalizeDonePayload(payload: any = {}) {
  return {
    answer: `${payload?.answer || ""}`,
    citations: Array.isArray(payload?.citations) ? payload.citations : [],
    toolTrace: Array.isArray(payload?.tool_trace) ? payload.tool_trace : [],
    rounds: Number(payload?.rounds) || 0,
    conversationId: `${payload?.conversation_id || payload?.conversationId || ""}`.trim(),
    agentRuntime: `${payload?.agent_runtime || payload?.["agentRuntime"] || ""}`.trim(),
    operationRefs: normalizeOperationRefs(payload?.operation_refs || payload?.["operationRefs"]),
    confirmationMode: normalizeConfirmationMode(payload?.confirmation_mode || payload?.["confirmationMode"]),
    confirmationRequests: normalizeConfirmationRequests(
      payload?.confirmation_requests || payload?.["confirmationRequests"],
    ),
    persisted: payload?.persisted !== false,
  };
}

function parseSseEvent(line = "") {
  const trimmed = `${line}`.replace(/\r$/, "");
  if (!trimmed.startsWith("data:")) return null;
  const jsonText = trimmed.slice("data:".length).trim();
  if (!jsonText) return null;
  try { return JSON.parse(jsonText); } catch { return null; }
}

export async function readAiAskStream(body: ReadableStream<Uint8Array>, {
  onProgressEvent = null,
  onToolEvent = null,
  onAgentToolEvent = null,
  onAgentOperationEvent = null,
  onAgentConfirmationRequiredEvent = null,
  onAgentSessionEvent = null,
  onAnswerDelta = null,
  onCompress = null,
}: AiAskStreamCallbacks = {}): Promise<any> {
  if (!body || typeof (body as any).getReader !== "function") throw new AiAskError("AI 服务响应格式异常,请重试。");
  const reader = (body as any).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: any = null;
  let streamedAnswer = "";
  let streamedAgentRuntime = "";
  const streamedOperationRefs: AgentOperationRef[] = [];

  function handleLine(line: string) {
    const event: any = parseSseEvent(line);
    if (!event || typeof event !== "object") return;
    if (event.type === "progress") {
      onProgressEvent?.({
        type: "progress",
        stage: event.stage === "retrieval" ? "retrieval" : "routing",
        message: `${event.message || ""}`.trim(),
      });
      return;
    }
    if (event.type === "heartbeat") return;
    if (event.type === "tool") { onToolEvent?.(event); return; }
    if (event.type === "agent_tool") {
      onAgentToolEvent?.(event as AgentToolEvent);
      onToolEvent?.(event);
      return;
    }
    if (event.type === "agent_session") {
      streamedAgentRuntime = `${event.agent_runtime || event.runtime || ""}`.trim();
      onAgentSessionEvent?.(event as AgentSessionEvent);
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
        const index = streamedOperationRefs.findIndex((item) =>
          typeof item === "string" ? item === operationId : item.operation_id === operationId);
        if (index >= 0) streamedOperationRefs[index] = ref;
        else streamedOperationRefs.push(ref);
      }
      onAgentOperationEvent?.(event as AgentOperationEvent);
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
      if (chunk) { streamedAnswer += chunk; onAnswerDelta?.(streamedAnswer, chunk); }
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
    if (event.type === "compress") { onCompress?.(event); return; }
  }

  try {
    while (!result) {
      const { done, value } = await reader.read();
      if (done) break;
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
      if (buffer.trim()) handleLine(buffer);
    }
  } finally {
    reader.cancel?.().catch?.(() => {});
    reader.releaseLock?.();
  }
  if (!result) throw new AiAskError("AI 服务响应中断,请重试。");
  return result;
}

async function extractErrorMessage(resp: Response): Promise<string> {
  const text = await resp.text().catch(() => "");
  try {
    const envelope: any = JSON.parse(text);
    const message = `${envelope?.message || ""}`.trim();
    if (message) return message;
    const detail: any = envelope?.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (Array.isArray(detail)) {
      const parts = detail.map((item: any) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") return `${(item as any).msg || (item as any).message || ""}`.trim();
        return "";
      }).filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
    return "";
  } catch { return `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, 240); }
}

export async function askLibraryAi({
  question = "",
  documentId = "",
  jobId = "",
  conversationId = "",
  parentId = "",
  regenerate = false,
  userMessageId = "",
  assistantMessageId = "",
  onToolEvent = null as ((e:any)=>void)|null,
  onProgressEvent = null as ((e:{ type:"progress"; stage:"routing"|"retrieval"; message:string })=>void)|null,
  onAgentToolEvent = null as ((e:AgentToolEvent)=>void)|null,
  onAgentOperationEvent = null as ((e:AgentOperationEvent)=>void)|null,
  onAgentConfirmationRequiredEvent = null as ((e:AgentConfirmationRequiredEvent)=>void)|null,
  onAgentSessionEvent = null as ((e:AgentSessionEvent)=>void)|null,
  onAnswerDelta = null as ((full:string, chunk:string)=>void)|null,
  onCompress = null as ((e:any)=>void)|null,
  signal = null as AbortSignal | null,
  apiPrefix = API_PREFIX,
  fetchImpl = fetch as typeof fetch,
  llmApiKey = "",
  llmBaseUrl = "",
  llmModel = "",
  confirmDocumentOperation = false,
  assistantMode = "auto" as AiAssistantMode,
}: {
  question?: string; documentId?: string; jobId?: string; conversationId?: string; parentId?: string; regenerate?: boolean; userMessageId?: string; assistantMessageId?: string;
  onToolEvent?: ((e:any)=>void)|null; onProgressEvent?: ((e:{ type:"progress"; stage:"routing"|"retrieval"; message:string })=>void)|null; onAgentToolEvent?: ((e:AgentToolEvent)=>void)|null; onAgentOperationEvent?: ((e:AgentOperationEvent)=>void)|null; onAgentConfirmationRequiredEvent?: ((e:AgentConfirmationRequiredEvent)=>void)|null; onAgentSessionEvent?: ((e:AgentSessionEvent)=>void)|null; onAnswerDelta?: ((full:string, chunk:string)=>void)|null; onCompress?: ((e:any)=>void)|null; signal?: AbortSignal | null; apiPrefix?: string; fetchImpl?: typeof fetch; llmApiKey?: string; llmBaseUrl?: string; llmModel?: string; confirmDocumentOperation?: boolean; assistantMode?: AiAssistantMode;
} = {}): Promise<any> {
  const trimmed = `${question}`.trim();
  if (!trimmed) throw new AiAskError("请输入问题。", 400);
  const payload: Record<string, any> = { question: trimmed, stream: true };
  const normalizedDocumentId = `${documentId || ""}`.trim();
  const normalizedJobId = `${jobId || ""}`.trim();
  const normalizedConversationId = `${conversationId || ""}`.trim();
  if (normalizedDocumentId) payload.document_id = normalizedDocumentId;
  if (normalizedJobId) payload.job_id = normalizedJobId;
  if (normalizedConversationId) payload.conversation_id = normalizedConversationId;
  const normalizedParentId = `${parentId || ""}`.trim();
  if (normalizedParentId) payload.parent_id = normalizedParentId;
  if (regenerate) payload.regenerate = true;
  const uid = `${userMessageId || ""}`.trim();
  const aid = `${assistantMessageId || ""}`.trim();
  if (uid) payload.user_message_id = uid;
  if (aid) payload.assistant_message_id = aid;
  if (confirmDocumentOperation === true) payload.confirm_document_operation = true;
  if (assistantMode === "reading" || assistantMode === "operations") {
    payload.assistant_mode = assistantMode;
  }
  const key = `${llmApiKey || ""}`.trim();
  if (key) payload.llm_api_key = key.replace(/^Bearer\s+/i, "").trim();
  if (`${llmBaseUrl || ""}`.trim()) payload.llm_base_url = `${llmBaseUrl}`.trim();
  if (`${llmModel || ""}`.trim()) payload.llm_model = `${llmModel}`.trim();
  const resp = await fetchImpl(buildApiEndpoint(apiPrefix, "ai/ask"), {
    method: "POST",
    headers: buildApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    signal: signal as any,
  });
  if (!resp.ok) {
    if (resp.status === 502) throw new AiAskError("AI 服务未运行(502),请先启动 retainpdf-ai 服务。", 502);
    const message = await extractErrorMessage(resp as any);
    if (resp.status === 401) {
      const hint = /X-API-Key|api key|invalid api key|Unauthorized/i.test(message) ? message : "服务鉴权失败：X-API-Key 无效或未配置（检查 runtime-config 的 xApiKey / 后端 auth 配置）。";
      throw new AiAskError(`${hint}(${resp.status})`, 401);
    }
    if (resp.status === 400 && /LLM|模型\s*API\s*Key|api key/i.test(message)) {
      throw new AiAskError(message.includes("凭据") || message.includes("设置") ? `${message}(${resp.status})` : `缺少模型 API Key：请到设置 → API 设置填写后再提问。(${resp.status})`, 400);
    }
    throw new AiAskError(`${message || "AI 问答请求失败,请稍后重试。"}(${resp.status})`, resp.status);
  }
  const contentType = `${(resp.headers as any)?.get?.("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    const result = normalizeDonePayload(unwrapEnvelope(await (resp as any).json()));
    for (const confirmation of result.confirmationRequests) {
      onAgentConfirmationRequiredEvent?.({
        type: "agent_confirmation_required",
        ...confirmation,
      });
    }
    return result;
  }
  return readAiAskStream(resp.body as any, {
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
