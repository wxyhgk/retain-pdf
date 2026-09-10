import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  cancelAgentOperation,
  commitAgentOperation,
  fetchAgentOperationCandidate,
  getAgentOperation,
  listAgentOperations,
  retryAgentOperation,
  runAgentOperation,
} from "@/platform/api/index.js";
import { createAgentOperationController } from "../../domain/operations/operation-controller.js";
import { agentOperationReducer, INITIAL_AGENT_OPERATION_STATE } from "../../domain/operations/operation-reducer.js";
import { hasActiveOperations, operationsByRequestMessage } from "../../domain/operations/operation-selectors.js";
import type {
  AgentConfirmationMode,
  AgentOperationAction,
  AgentOperationPerformOptions,
  AgentOperationView,
} from "../../domain/operations/types.js";
import type { HomeAgentOperationSignal } from "../use-home-ask-runtime.js";

export function useAgentOperations(
  conversationId: string,
  discovering = false,
  signal: HomeAgentOperationSignal | HomeAgentOperationSignal[] | null = null,
  confirmationMode: AgentConfirmationMode = "explicit",
) {
  const [state, dispatch] = useReducer(agentOperationReducer, INITIAL_AGENT_OPERATION_STATE);
  const controller = useMemo(() => createAgentOperationController({
    list: listAgentOperations,
    get: getAgentOperation,
    run: runAgentOperation,
    cancel: cancelAgentOperation,
    commit: commitAgentOperation,
    retry: retryAgentOperation,
  }, dispatch), []);

  const recover = useCallback(() => {
    if (conversationId) void controller.recover(conversationId);
  }, [controller, conversationId]);

  useEffect(() => {
    recover();
  }, [recover]);

  // A fast Agent turn can finish before the discovery interval fires. Always
  // perform one final authoritative list fetch when streaming stops.
  useEffect(() => {
    if (!discovering) recover();
  }, [discovering, recover]);

  useEffect(() => {
    const operationIds = new Set(
      (Array.isArray(signal) ? signal : signal ? [signal] : [])
        .filter((item) => item.operationId && item.conversationId === conversationId)
        .map((item) => item.operationId),
    );
    for (const operationId of operationIds) {
      void controller.refresh(operationId);
    }
  }, [controller, conversationId, signal]);

  useEffect(() => {
    const onOnline = () => recover();
    const onVisibility = () => {
      if (document.visibilityState === "visible") recover();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [recover]);

  const active = conversationId
    ? hasActiveOperations(state, conversationId, confirmationMode)
    : false;
  useEffect(() => {
    if (!conversationId || (!active && !discovering)) return;
    const timer = window.setInterval(() => {
      void controller.recover(conversationId);
      for (const id of state.idsByConversation[conversationId] || []) {
        void controller.refresh(id);
      }
    }, 1600);
    return () => window.clearInterval(timer);
  }, [active, controller, conversationId, discovering, state.idsByConversation]);

  useEffect(() => () => controller.dispose(), [controller]);

  const perform = useCallback((
    action: AgentOperationAction,
    operation: AgentOperationView,
    options?: AgentOperationPerformOptions,
  ) => (
    controller.perform(action, operation, options)
  ), [controller]);

  const loadCandidate = useCallback((operation: AgentOperationView) => (
    fetchAgentOperationCandidate(operation.operation_id)
  ), []);

  const byRequestMessage = useMemo(
    () => operationsByRequestMessage(state, conversationId),
    [conversationId, state],
  );

  return {
    state,
    byRequestMessage,
    recover,
    perform,
    loadCandidate,
  };
}
