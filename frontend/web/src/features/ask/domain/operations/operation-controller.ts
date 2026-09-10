import type {
  AgentOperationAction,
  AgentOperationPerformOptions,
  AgentOperationReducerAction,
  AgentOperationStatus,
  AgentOperationView,
} from "./types.js";

export type AgentOperationApi = {
  list: (options: { conversationId: string }) => Promise<unknown>;
  get: (operationId: string) => Promise<unknown>;
  run: (operationId: string, input: Record<string, unknown>) => Promise<unknown>;
  cancel: (operationId: string, input: Record<string, unknown>) => Promise<unknown>;
  commit: (operationId: string, input: Record<string, unknown>) => Promise<unknown>;
  retry: (operationId: string, input: Record<string, unknown>) => Promise<unknown>;
};

type Dispatch = (action: AgentOperationReducerAction) => void;
type ActionKeyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const ACTION_KEY_PREFIX = "retainpdf.agent-operation.action-key.v1:";

function browserActionKeyStorage(): ActionKeyStorage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function makeIdempotencyKey(operationId: string, action: AgentOperationAction): string {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `ui-${action}-${operationId}-${random}`.slice(0, 128);
}

function asOperation(value: unknown): AgentOperationView {
  const source = value && typeof value === "object" && "data" in value
    ? (value as { data?: unknown }).data
    : value;
  return source as AgentOperationView;
}

function asOperations(value: unknown): AgentOperationView[] {
  const source = value && typeof value === "object" && "data" in value
    ? (value as { data?: unknown }).data
    : value;
  if (Array.isArray(source)) return source as AgentOperationView[];
  if (source && typeof source === "object" && Array.isArray((source as { operations?: unknown[] }).operations)) {
    return (source as { operations: AgentOperationView[] }).operations;
  }
  return [];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "操作请求失败，请重试。";
}

function errorStatus(error: unknown): number {
  if (!error || typeof error !== "object" || !("status" in error)) return 0;
  const status = Number((error as { status?: unknown }).status);
  return Number.isFinite(status) ? status : 0;
}

export function createAgentOperationController(
  api: AgentOperationApi,
  dispatch: Dispatch,
  keyStorage = browserActionKeyStorage(),
) {
  const actionKeys = new Map<string, string>();
  const inFlight = new Set<string>();

  async function recover(conversationId: string) {
    const id = `${conversationId || ""}`.trim();
    if (!id || inFlight.has(`recover:${id}`)) return;
    inFlight.add(`recover:${id}`);
    dispatch({ type: "recovery-start", conversationId: id });
    try {
      const response = await api.list({ conversationId: id });
      dispatch({ type: "hydrate", conversationId: id, operations: asOperations(response) });
    } catch {
      dispatch({ type: "recovery-error", conversationId: id });
    } finally {
      inFlight.delete(`recover:${id}`);
    }
  }

  async function refresh(operationId: string) {
    const id = `${operationId || ""}`.trim();
    if (!id || inFlight.has(`refresh:${id}`)) return;
    inFlight.add(`refresh:${id}`);
    try {
      const operation = asOperation(await api.get(id));
      if (operation?.operation_id) dispatch({ type: "upsert", operation });
    } finally {
      inFlight.delete(`refresh:${id}`);
    }
  }

  async function perform(
    action: AgentOperationAction,
    operation: AgentOperationView,
    options: AgentOperationPerformOptions = {},
  ) {
    const operationId = `${operation.operation_id || ""}`.trim();
    if (!operationId || inFlight.has(`action:${operationId}`)) return;
    if (action === "retry" && operation.status === "ambiguous" && options.acceptDuplicateRisk !== true) {
      dispatch({
        type: "action-error",
        operationId,
        message: "请先确认重复执行风险，再重新执行操作。",
      });
      return;
    }
    const keySlot = `${operationId}:${action}`;
    const storageSlot = `${ACTION_KEY_PREFIX}${keySlot}`;
    let persistedKey = "";
    try {
      persistedKey = `${keyStorage?.getItem(storageSlot) || ""}`.trim();
    } catch {
      /* storage is only a refresh-recovery hint */
    }
    const idempotencyKey = actionKeys.get(keySlot) || persistedKey || makeIdempotencyKey(operationId, action);
    actionKeys.set(keySlot, idempotencyKey);
    try {
      keyStorage?.setItem(storageSlot, idempotencyKey);
    } catch {
      /* continue with in-memory idempotency */
    }
    inFlight.add(`action:${operationId}`);
    dispatch({ type: "action-start", operationId, action });
    const common = {
      idempotency_key: idempotencyKey,
      expected_attempt: operation.current_attempt,
      expected_status: operation.status,
      expected_program_sha256: operation.program_sha256 || "",
    };
    try {
      let response: unknown;
      if (action === "run") {
        response = await api.run(operationId, common);
      } else if (action === "cancel") {
        response = await api.cancel(operationId, { ...common, reason: "user_rejected" });
      } else if (action === "commit") {
        response = await api.commit(operationId, common);
      } else {
        response = await api.retry(operationId, options.acceptDuplicateRisk === true
          ? { ...common, accept_duplicate_risk: true }
          : common);
      }
      const next = asOperation(response);
      if (!next?.operation_id) throw new Error("操作服务返回了无效状态。");
      actionKeys.delete(keySlot);
      try {
        keyStorage?.removeItem(storageSlot);
      } catch {
        /* successful server response is authoritative */
      }
      dispatch({ type: "action-finish", operation: next });
    } catch (error) {
      if (errorStatus(error) === 409) {
        // A CAS conflict is a definitive rejection, not an unknown submit
        // result. Discard the key and refresh the server-owned snapshot rather
        // than replaying the mutation with stale expectations.
        actionKeys.delete(keySlot);
        try {
          keyStorage?.removeItem(storageSlot);
        } catch {
          /* the authoritative refresh below still prevents a blind retry */
        }
        try {
          const current = asOperation(await api.get(operationId));
          if (!current?.operation_id) throw new Error("操作服务返回了无效状态。");
          dispatch({ type: "action-finish", operation: current });
        } catch {
          dispatch({
            type: "action-error",
            operationId,
            message: "操作状态已发生变化，但刷新失败，请稍后重试。",
          });
        }
      } else {
        dispatch({ type: "action-error", operationId, message: errorMessage(error) });
      }
    } finally {
      inFlight.delete(`action:${operationId}`);
    }
  }

  function dispose() {
    actionKeys.clear();
    inFlight.clear();
  }

  return { recover, refresh, perform, dispose };
}

export function operationStatusLabel(
  status: AgentOperationStatus,
  confirmationMode: "explicit" | "green_light" = "explicit",
): string {
  switch (status) {
    case "draft":
    case "awaiting_confirmation": return confirmationMode === "green_light" ? "等待自动执行" : "等待确认";
    case "queued": return "等待执行";
    case "running": return "正在执行";
    case "validating": return "正在验证候选文件";
    case "result_ready": return confirmationMode === "green_light" ? "等待自动应用" : "候选文件已就绪";
    case "committed": return confirmationMode === "green_light" ? "AI 已直接应用" : "已应用";
    case "failed": return "执行失败";
    case "cancelled": return "已取消";
    case "ambiguous": return "执行结果不确定";
    default: return status;
  }
}
