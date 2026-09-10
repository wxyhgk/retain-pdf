import { API_PREFIX, buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";

export type AgentOperationStatus =
  | "draft"
  | "awaiting_confirmation"
  | "queued"
  | "running"
  | "validating"
  | "result_ready"
  | "committed"
  | "failed"
  | "cancelled"
  | "ambiguous"
  | (string & {});

export type AgentOperationAction =
  | "run"
  | "cancel"
  | "commit"
  | "retry"
  | (string & {});

export type AgentOperationEventView = {
  seq: number;
  attempt: number;
  ts: string;
  event: string;
  status: AgentOperationStatus;
  summary?: string;
  payload?: Record<string, unknown>;
};

export type AgentOperationCandidateView = {
  version_id: string;
  status: string;
  content_sha256: string;
  url: string;
};

export type AgentOperationPlanStepView = {
  op: "select_pages" | "rotate_pages" | (string & {});
  pages: number[];
  degrees?: number;
};

/**
 * Browser-safe operation projection returned by the public AI facade.
 *
 * The public endpoint intentionally does not require internal workspace
 * manifests, receipts, artifact keys, filesystem paths, or raw stderr. Extra
 * forward-compatible public fields are allowed without weakening the stable
 * identity/status fields used by the UI.
 */
export type AgentOperationView = {
  schema: string;
  operation_id: string;
  conversation_id?: string | null;
  request_message_id: string;
  document_id: string;
  intent_summary: string;
  plan_steps: AgentOperationPlanStepView[];
  affected_pages: number[];
  status: AgentOperationStatus;
  current_attempt: number;
  program_sha256: string;
  candidate_available: boolean;
  candidate: AgentOperationCandidateView | null;
  latest_event_seq: number;
  allowed_actions: AgentOperationAction[];
  events: AgentOperationEventView[];
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export type AgentOperationListView = {
  operations: AgentOperationView[];
};

export type AgentOperationActionInput = {
  schema?: "document_operation_action_v1" | string;
  idempotency_key: string;
  expected_status: AgentOperationStatus;
  expected_attempt: number;
  expected_program_sha256: string;
};

export type AgentOperationRunInput = AgentOperationActionInput;

export type AgentOperationCancelInput = AgentOperationActionInput & {
  reason?: string;
};

export type AgentOperationCommitInput = AgentOperationActionInput;

export type AgentOperationRetryInput = AgentOperationActionInput & {
  accept_duplicate_risk?: boolean;
};

export type AgentOperationRequestOptions = {
  apiPrefix?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal | null;
};

export type ListAgentOperationsInput = AgentOperationRequestOptions & {
  conversationId: string;
  limit?: number;
};

export class AgentOperationError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "AgentOperationError";
    this.status = status;
  }
}

function requiredId(value: string, field: string): string {
  const normalized = `${value || ""}`.trim();
  if (!normalized) throw new AgentOperationError(`${field} required`, 400);
  return normalized;
}

async function extractErrorMessage(resp: Response): Promise<string> {
  const text = await resp.text().catch(() => "");
  try {
    const payload: any = JSON.parse(text);
    return `${payload?.message || payload?.detail || ""}`.trim();
  } catch {
    return `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, 240);
  }
}

async function requestAgentOperation<T>(
  path: string,
  init: RequestInit,
  options: AgentOperationRequestOptions = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl || fetch;
  const resp = await fetchImpl(buildApiEndpoint(options.apiPrefix || API_PREFIX, path), {
    ...init,
    headers: buildApiHeaders({
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
    }),
    signal: options.signal as AbortSignal | undefined,
  });
  if (!resp.ok) {
    const message = await extractErrorMessage(resp);
    throw new AgentOperationError(
      `${message || "Agent operation request failed."}(${resp.status})`,
      resp.status,
    );
  }
  if (resp.status === 204) return { ok: true } as T;
  return unwrapEnvelope(await resp.json()) as T;
}

function operationPath(operationId: string, action = ""): string {
  const id = requiredId(operationId, "operation_id");
  return `ai/operations/${encodeURIComponent(id)}${action ? `/${action}` : ""}`;
}

export async function listAgentOperations({
  conversationId,
  limit,
  apiPrefix = API_PREFIX,
  fetchImpl = fetch,
  signal = null,
}: ListAgentOperationsInput): Promise<AgentOperationListView> {
  const conversation = requiredId(conversationId, "conversation_id");
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  const suffix = params.toString();
  const payload: any = await requestAgentOperation<any>(
    `ai/conversations/${encodeURIComponent(conversation)}/operations${suffix ? `?${suffix}` : ""}`,
    { method: "GET" },
    { apiPrefix, fetchImpl, signal },
  );
  if (Array.isArray(payload)) return { operations: payload };
  return {
    ...payload,
    operations: Array.isArray(payload?.operations)
      ? payload.operations
      : Array.isArray(payload?.items)
        ? payload.items
        : [],
  };
}

export async function getAgentOperation(
  operationId: string,
  options: AgentOperationRequestOptions = {},
): Promise<AgentOperationView> {
  return requestAgentOperation<AgentOperationView>(
    operationPath(operationId),
    { method: "GET" },
    options,
  );
}

export async function runAgentOperation(
  operationId: string,
  input: AgentOperationRunInput,
  options: AgentOperationRequestOptions = {},
): Promise<AgentOperationView> {
  return requestAgentOperation<AgentOperationView>(
    operationPath(operationId, "run"),
    {
      method: "POST",
      body: JSON.stringify({ ...input, schema: "document_operation_action_v1" }),
    },
    options,
  );
}

export async function cancelAgentOperation(
  operationId: string,
  input: AgentOperationCancelInput,
  options: AgentOperationRequestOptions = {},
): Promise<AgentOperationView> {
  return requestAgentOperation<AgentOperationView>(
    operationPath(operationId, "cancel"),
    {
      method: "POST",
      body: JSON.stringify({ ...input, schema: "document_operation_action_v1" }),
    },
    options,
  );
}

export async function commitAgentOperation(
  operationId: string,
  input: AgentOperationCommitInput,
  options: AgentOperationRequestOptions = {},
): Promise<AgentOperationView> {
  return requestAgentOperation<AgentOperationView>(
    operationPath(operationId, "commit"),
    {
      method: "POST",
      body: JSON.stringify({ ...input, schema: "document_operation_action_v1" }),
    },
    options,
  );
}

export async function retryAgentOperation(
  operationId: string,
  input: AgentOperationRetryInput,
  options: AgentOperationRequestOptions = {},
): Promise<AgentOperationView> {
  return requestAgentOperation<AgentOperationView>(
    operationPath(operationId, "retry"),
    {
      method: "POST",
      body: JSON.stringify({ ...input, schema: "document_operation_action_v1" }),
    },
    options,
  );
}

export async function fetchAgentOperationCandidate(
  operationId: string,
  options: AgentOperationRequestOptions = {},
): Promise<Blob> {
  const fetchImpl = options.fetchImpl || fetch;
  const url = buildAgentOperationCandidateUrl(operationId, options.apiPrefix || API_PREFIX);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: buildApiHeaders(),
    signal: options.signal as AbortSignal | undefined,
  });
  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new AgentOperationError(
      `${message || "Agent candidate download failed."}(${response.status})`,
      response.status,
    );
  }
  return response.blob();
}

export function buildAgentOperationCandidateUrl(
  operationId: string,
  apiPrefix = API_PREFIX,
): string {
  return buildApiEndpoint(apiPrefix, `${operationPath(operationId)}/candidate.pdf`);
}
