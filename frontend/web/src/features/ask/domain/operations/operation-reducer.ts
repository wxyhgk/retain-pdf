import type {
  AgentOperationEntry,
  AgentOperationReducerAction,
  AgentOperationState,
  AgentOperationView,
} from "./types.js";

export const INITIAL_AGENT_OPERATION_STATE: AgentOperationState = {
  byId: {},
  idsByConversation: {},
  idsByRequestMessage: {},
  recoveryByConversation: {},
};

function latestSeq(operation: AgentOperationView): number {
  if (Number.isFinite(Number(operation.latest_event_seq))) {
    return Number(operation.latest_event_seq);
  }
  return Math.max(0, ...(operation.events || []).map((event) => Number(event.seq) || 0));
}

function shouldReplace(current: AgentOperationView | undefined, next: AgentOperationView): boolean {
  if (!current) return true;
  if (next.current_attempt !== current.current_attempt) {
    return next.current_attempt > current.current_attempt;
  }
  const currentSeq = latestSeq(current);
  const nextSeq = latestSeq(next);
  if (currentSeq !== nextSeq) return nextSeq > currentSeq;
  return `${next.updated_at || ""}` >= `${current.updated_at || ""}`;
}

function appendUnique(map: Record<string, string[]>, key: string, value: string) {
  if (!key) return map;
  const current = map[key] || [];
  if (current.includes(value)) return map;
  return { ...map, [key]: [...current, value] };
}

function putOperation(
  state: AgentOperationState,
  operation: AgentOperationView,
  entryPatch: Partial<AgentOperationEntry> = {},
): AgentOperationState {
  const operationId = `${operation.operation_id || ""}`.trim();
  if (!operationId) return state;
  const currentEntry = state.byId[operationId];
  if (!shouldReplace(currentEntry?.remote, operation)) return state;
  const nextEntry: AgentOperationEntry = {
    ...currentEntry,
    ...entryPatch,
    remote: operation,
  };
  return {
    ...state,
    byId: { ...state.byId, [operationId]: nextEntry },
    idsByConversation: appendUnique(
      state.idsByConversation,
      `${operation.conversation_id || ""}`.trim(),
      operationId,
    ),
    idsByRequestMessage: appendUnique(
      state.idsByRequestMessage,
      `${operation.request_message_id || ""}`.trim(),
      operationId,
    ),
  };
}

export function agentOperationReducer(
  state: AgentOperationState,
  action: AgentOperationReducerAction,
): AgentOperationState {
  switch (action.type) {
    case "recovery-start":
      return {
        ...state,
        recoveryByConversation: {
          ...state.recoveryByConversation,
          [action.conversationId]: "loading",
        },
      };
    case "recovery-error":
      return {
        ...state,
        recoveryByConversation: {
          ...state.recoveryByConversation,
          [action.conversationId]: "error",
        },
      };
    case "hydrate": {
      let next = state;
      for (const operation of action.operations) {
        next = putOperation(next, operation);
      }
      return {
        ...next,
        recoveryByConversation: {
          ...next.recoveryByConversation,
          [action.conversationId]: "ready",
        },
      };
    }
    case "upsert":
      return putOperation(state, action.operation);
    case "action-start": {
      const current = state.byId[action.operationId];
      if (!current) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.operationId]: { ...current, pendingAction: action.action, error: undefined },
        },
      };
    }
    case "action-error": {
      const current = state.byId[action.operationId];
      if (!current) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.operationId]: { ...current, pendingAction: undefined, error: action.message },
        },
      };
    }
    case "action-finish":
      return putOperation(state, action.operation, { pendingAction: undefined, error: undefined });
    case "clear":
      return INITIAL_AGENT_OPERATION_STATE;
    default:
      return state;
  }
}
