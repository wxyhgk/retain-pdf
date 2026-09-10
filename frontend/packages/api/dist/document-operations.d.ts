export type AgentOperationStatus = "draft" | "awaiting_confirmation" | "queued" | "running" | "validating" | "result_ready" | "committed" | "failed" | "cancelled" | "ambiguous" | (string & {});
export type AgentOperationAction = "run" | "cancel" | "commit" | "retry" | (string & {});
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
export declare class AgentOperationError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
export declare function listAgentOperations({ conversationId, limit, apiPrefix, fetchImpl, signal, }: ListAgentOperationsInput): Promise<AgentOperationListView>;
export declare function getAgentOperation(operationId: string, options?: AgentOperationRequestOptions): Promise<AgentOperationView>;
export declare function runAgentOperation(operationId: string, input: AgentOperationRunInput, options?: AgentOperationRequestOptions): Promise<AgentOperationView>;
export declare function cancelAgentOperation(operationId: string, input: AgentOperationCancelInput, options?: AgentOperationRequestOptions): Promise<AgentOperationView>;
export declare function commitAgentOperation(operationId: string, input: AgentOperationCommitInput, options?: AgentOperationRequestOptions): Promise<AgentOperationView>;
export declare function retryAgentOperation(operationId: string, input: AgentOperationRetryInput, options?: AgentOperationRequestOptions): Promise<AgentOperationView>;
export declare function fetchAgentOperationCandidate(operationId: string, options?: AgentOperationRequestOptions): Promise<Blob>;
export declare function buildAgentOperationCandidateUrl(operationId: string, apiPrefix?: string): string;
