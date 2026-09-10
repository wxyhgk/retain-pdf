import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelAgentOperation,
  commitAgentOperation,
  fetchAgentOperationCandidate,
  getAgentOperation,
  listAgentOperations,
  retryAgentOperation,
  runAgentOperation,
  type AgentOperationView,
} from "@retainpdf/api/document-operations";
import {
  fetchAgentRuntimeConfig,
  type AgentConfirmationMode,
} from "@retainpdf/api/agent-runtime-settings";

export type ReaderAgentOperationSignal = {
  operationId: string;
  conversationId?: string;
  confirmationMode?: AgentConfirmationMode;
  nonce: number;
};

export type ReaderAgentOperationEntry = {
  operation: AgentOperationView;
  pendingAction?: "run" | "cancel" | "commit" | "retry";
  error?: string;
};

export type ReaderAgentOperationPerformOptions = {
  acceptDuplicateRisk?: boolean;
};

const ACTION_KEY_PREFIX = "retainpdf.reader-agent-operation.action-key.v1:";
const ACTIVE_STATUSES = new Set(["queued", "running", "validating"]);
const GREEN_LIGHT_TRANSITION_STATUSES = new Set(["draft", "awaiting_confirmation", "result_ready"]);

function shouldPoll(status: string, mode: AgentConfirmationMode): boolean {
  return ACTIVE_STATUSES.has(status)
    || (mode === "green_light" && GREEN_LIGHT_TRANSITION_STATUSES.has(status));
}

function eventSeq(operation: AgentOperationView): number {
  return Number(operation.latest_event_seq)
    || Math.max(0, ...(operation.events || []).map((event) => Number(event.seq) || 0));
}

export function shouldReplaceAgentOperation(
  current: AgentOperationView | undefined,
  next: AgentOperationView,
): boolean {
  if (!current) return true;
  if (next.current_attempt !== current.current_attempt) {
    return next.current_attempt > current.current_attempt;
  }
  if (eventSeq(next) !== eventSeq(current)) return eventSeq(next) > eventSeq(current);
  // Equal snapshots are common while polling. Replacing them used to clear a
  // pending action or its error even though the server had not advanced.
  return `${next.updated_at || ""}` > `${current.updated_at || ""}`;
}

function makeActionKey(operationId: string, action: string): string {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `reader-${action}-${operationId}-${random}`.slice(0, 128);
}

function errorStatus(error: unknown): number {
  return Number((error as { status?: unknown })?.status) || 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : "操作请求失败，请重试。";
}

export function useReaderAgentOperations({
  conversationId,
  enabled,
  discovering,
  signal,
  confirmationModeHint,
  onDocumentCommitted,
}: {
  conversationId: string;
  enabled: boolean;
  discovering: boolean;
  signal: ReaderAgentOperationSignal | null;
  confirmationModeHint?: AgentConfirmationMode;
  onDocumentCommitted?: (input: { documentId: string; revision: string }) => void;
}) {
  const [entriesById, setEntriesById] = useState<Record<string, ReaderAgentOperationEntry>>({});
  const [confirmationMode, setConfirmationMode] = useState<AgentConfirmationMode>("explicit");
  const [runtimeRestarting, setRuntimeRestarting] = useState(false);
  const [runtimeCredentialConfigured, setRuntimeCredentialConfigured] = useState(false);
  const inFlightRef = useRef(new Set<string>());
  const actionKeysRef = useRef(new Map<string, string>());
  const notifiedCommittedRef = useRef(new Set<string>());
  const recoveredConversationRef = useRef(new Set<string>());

  const upsert = useCallback((operation: AgentOperationView, settlePending = false) => {
    if (!operation?.operation_id) return;
    setEntriesById((current) => {
      const entry = current[operation.operation_id];
      if (!shouldReplaceAgentOperation(entry?.operation, operation)) {
        if (!settlePending || !entry?.pendingAction) return current;
        return {
          ...current,
          [operation.operation_id]: { ...entry, pendingAction: undefined },
        };
      }
      return {
        ...current,
        [operation.operation_id]: {
          ...entry,
          operation,
          pendingAction: undefined,
          error: undefined,
        },
      };
    });
  }, []);

  const refresh = useCallback(async (operationId: string, settlePending = false) => {
    const id = `${operationId || ""}`.trim();
    const slot = `refresh:${id}`;
    if (!id || inFlightRef.current.has(slot)) return;
    inFlightRef.current.add(slot);
    try {
      upsert(await getAgentOperation(id), settlePending);
    } catch {
      // SSE events are hints. A following list/poll remains authoritative.
    } finally {
      inFlightRef.current.delete(slot);
    }
  }, [upsert]);

  const recover = useCallback(async () => {
    const id = `${conversationId || ""}`.trim();
    const slot = `recover:${id}`;
    if (!enabled || !id || inFlightRef.current.has(slot)) return;
    inFlightRef.current.add(slot);
    try {
      const result = await listAgentOperations({ conversationId: id, limit: 50 });
      // The first list request hydrates history. A committed operation found in
      // that baseline is not a new commit and must not force the Reader back to
      // the source PDF. Later transitions are still announced normally.
      if (!recoveredConversationRef.current.has(id)) {
        for (const operation of result.operations || []) {
          if (operation.status === "committed") {
            notifiedCommittedRef.current.add(operation.operation_id);
          }
        }
        recoveredConversationRef.current.add(id);
      }
      for (const operation of result.operations || []) upsert(operation);
    } catch {
      // Conversation remains usable when operation recovery is temporarily unavailable.
    } finally {
      inFlightRef.current.delete(slot);
    }
  }, [conversationId, enabled, upsert]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const config = await fetchAgentRuntimeConfig();
        if (cancelled) return;
        setConfirmationMode(config.agent_confirmation_mode || "explicit");
        setRuntimeCredentialConfigured(Boolean(config.llm_api_key_configured));
        setRuntimeRestarting(
          config.restart_required
          || config.restart_state === "pending"
          || config.active_revision !== config.configured_revision,
        );
      } catch {
        if (!cancelled) {
          setRuntimeRestarting(false);
          setRuntimeCredentialConfigured(false);
        }
      }
    };
    void load();
    const timer = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  useEffect(() => {
    if (confirmationModeHint) setConfirmationMode(confirmationModeHint);
  }, [confirmationModeHint]);

  useEffect(() => {
    if (signal?.confirmationMode) setConfirmationMode(signal.confirmationMode);
    if (signal?.operationId) void refresh(signal.operationId);
  }, [refresh, signal]);

  useEffect(() => {
    void recover();
  }, [recover]);

  useEffect(() => {
    if (!discovering) void recover();
  }, [discovering, recover]);

  const entries = useMemo(() => Object.values(entriesById)
    .filter((entry) => Boolean(conversationId) && entry.operation.conversation_id === conversationId)
    .sort((a, b) => `${a.operation.created_at || ""}`.localeCompare(`${b.operation.created_at || ""}`)),
  [conversationId, entriesById]);

  useEffect(() => {
    for (const entry of entries) {
      const operation = entry.operation;
      if (operation.status !== "committed" || notifiedCommittedRef.current.has(operation.operation_id)) {
        continue;
      }
      notifiedCommittedRef.current.add(operation.operation_id);
      onDocumentCommitted?.({
        documentId: operation.document_id,
        revision: operation.candidate?.version_id
          || `${operation.updated_at || ""}`
          || `${operation.operation_id}:${eventSeq(operation)}`,
      });
    }
  }, [entries, onDocumentCommitted]);

  const needsPolling = entries.some((entry) => shouldPoll(entry.operation.status, confirmationMode));
  useEffect(() => {
    if (!enabled || !conversationId || (!discovering && !needsPolling)) return;
    const timer = window.setInterval(() => {
      void recover();
      for (const entry of entries) {
        if (shouldPoll(entry.operation.status, confirmationMode)) {
          void refresh(entry.operation.operation_id);
        }
      }
    }, 1400);
    return () => window.clearInterval(timer);
  }, [confirmationMode, conversationId, discovering, enabled, entries, needsPolling, recover, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const sync = () => void recover();
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, recover]);

  const perform = useCallback(async (
    action: "run" | "cancel" | "commit" | "retry",
    operation: AgentOperationView,
    options: ReaderAgentOperationPerformOptions = {},
  ) => {
    const operationId = `${operation.operation_id || ""}`.trim();
    const flightSlot = `action:${operationId}`;
    if (!operationId || inFlightRef.current.has(flightSlot)) return;
    if (action === "retry" && operation.status === "ambiguous" && options.acceptDuplicateRisk !== true) {
      setEntriesById((current) => ({
        ...current,
        [operationId]: {
          ...current[operationId],
          error: "请先确认重复执行风险，再重新执行操作。",
        },
      }));
      return;
    }

    const keySlot = `${operationId}:${action}`;
    const storageSlot = `${ACTION_KEY_PREFIX}${keySlot}`;
    let storedKey = "";
    try { storedKey = `${sessionStorage.getItem(storageSlot) || ""}`.trim(); } catch { /* optional */ }
    const idempotencyKey = actionKeysRef.current.get(keySlot)
      || storedKey
      || makeActionKey(operationId, action);
    actionKeysRef.current.set(keySlot, idempotencyKey);
    try { sessionStorage.setItem(storageSlot, idempotencyKey); } catch { /* optional */ }

    inFlightRef.current.add(flightSlot);
    setEntriesById((current) => ({
      ...current,
      [operationId]: { ...current[operationId], pendingAction: action, error: undefined },
    }));

    const common = {
      idempotency_key: idempotencyKey,
      expected_status: operation.status,
      expected_attempt: operation.current_attempt,
      expected_program_sha256: operation.program_sha256 || "",
    };
    try {
      let next: AgentOperationView;
      if (action === "run") next = await runAgentOperation(operationId, common);
      else if (action === "cancel") {
        next = await cancelAgentOperation(operationId, { ...common, reason: "user_rejected" });
      } else if (action === "commit") next = await commitAgentOperation(operationId, common);
      else {
        next = await retryAgentOperation(operationId, options.acceptDuplicateRisk
          ? { ...common, accept_duplicate_risk: true }
          : common);
      }
      actionKeysRef.current.delete(keySlot);
      try { sessionStorage.removeItem(storageSlot); } catch { /* optional */ }
      upsert(next, true);
    } catch (error) {
      if (errorStatus(error) === 409) {
        actionKeysRef.current.delete(keySlot);
        try { sessionStorage.removeItem(storageSlot); } catch { /* optional */ }
        await refresh(operationId, true);
      } else {
        setEntriesById((current) => ({
          ...current,
          [operationId]: {
            ...current[operationId],
            pendingAction: undefined,
            error: errorMessage(error),
          },
        }));
      }
    } finally {
      inFlightRef.current.delete(flightSlot);
    }
  }, [refresh, upsert]);

  const loadCandidate = useCallback((operation: AgentOperationView) => (
    fetchAgentOperationCandidate(operation.operation_id)
  ), []);

  return {
    entries,
    confirmationMode,
    runtimeRestarting,
    runtimeCredentialConfigured,
    perform,
    loadCandidate,
  };
}
