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
  | "ambiguous";

export type AgentOperationEvent = {
  seq: number;
  attempt: number;
  ts: string;
  event: string;
  status: AgentOperationStatus;
  payload?: Record<string, unknown>;
};

export type AgentCandidateVersion = {
  version_id: string;
  status: string;
  content_sha256?: string;
  url?: string;
  created_at?: string;
  committed_at?: string | null;
};

export type AgentOperationPlanStep = {
  op: "select_pages" | "rotate_pages" | string;
  pages: number[];
  degrees?: number;
};

export type AgentOperationView = {
  operation_id: string;
  conversation_id: string;
  request_message_id: string;
  document_id: string;
  intent_summary: string;
  plan_summary?: string;
  plan_steps?: AgentOperationPlanStep[];
  affected_pages?: number[];
  status: AgentOperationStatus;
  current_attempt: number;
  program_sha256?: string;
  latest_event_seq?: number;
  allowed_actions?: string[];
  candidate_available?: boolean;
  candidate_url?: string;
  candidate?: AgentCandidateVersion | null;
  candidate_version?: AgentCandidateVersion | null;
  events?: AgentOperationEvent[];
  created_at?: string;
  updated_at?: string;
};

export type AgentOperationAction = "run" | "cancel" | "commit" | "retry";

export type AgentConfirmationMode = "explicit" | "green_light";

export type AgentOperationPerformOptions = {
  acceptDuplicateRisk?: boolean;
};

export type AgentOperationEntry = {
  remote: AgentOperationView;
  pendingAction?: AgentOperationAction;
  error?: string;
};

export type AgentOperationState = {
  byId: Record<string, AgentOperationEntry>;
  idsByConversation: Record<string, string[]>;
  idsByRequestMessage: Record<string, string[]>;
  recoveryByConversation: Record<string, "idle" | "loading" | "ready" | "error">;
};

export type AgentOperationReducerAction =
  | { type: "recovery-start"; conversationId: string }
  | { type: "recovery-error"; conversationId: string }
  | { type: "hydrate"; conversationId: string; operations: AgentOperationView[] }
  | { type: "upsert"; operation: AgentOperationView }
  | { type: "action-start"; operationId: string; action: AgentOperationAction }
  | { type: "action-error"; operationId: string; message: string }
  | { type: "action-finish"; operation: AgentOperationView }
  | { type: "clear" };

export type AgentOperationActionHandlers = {
  run: (operation: AgentOperationView) => void | Promise<void>;
  cancel: (operation: AgentOperationView) => void | Promise<void>;
  commit: (operation: AgentOperationView) => void | Promise<void>;
  retry: (operation: AgentOperationView) => void | Promise<void>;
};
