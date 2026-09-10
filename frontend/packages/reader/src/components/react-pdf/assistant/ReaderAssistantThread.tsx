// Runtime adapter for the Reader AI thread. The complete assistant-ui surface
// lives in ReaderAssistantSurface so backend state and chat presentation do
// not grow into one component again.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import {
  CREDENTIALS_CHANGED_EVENT,
  hasModelApiKey,
  type AiCitationLike,
} from "../../../external.js";
import { ReaderAssistantSurface } from "./ReaderAssistantSurface.js";
import { ReaderAgentOperationPanel } from "./ReaderAgentOperationPanel.js";
import type { useReaderAgentOperations } from "./use-reader-agent-operations.js";
import type { ReaderAskStoreMessage } from "./reader-ask-tree.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
import type { ReaderSelection } from "../../../shared/data/reader-regions.js";

const identityMessageConverter = (message: ThreadMessageLike): ThreadMessageLike => message;
const EMPTY_MESSAGES: readonly ReaderAskStoreMessage[] = Object.freeze([]);
const EMPTY_CITATIONS: Record<string, AiCitationLike[]> = Object.freeze({});
const EMPTY_TEXT_BY_MESSAGE: Record<string, string> = Object.freeze({});
const EMPTY_AGENT_OPERATIONS = Object.freeze({
  entries: [],
  confirmationMode: "explicit" as const,
  runtimeRestarting: false,
  runtimeCredentialConfigured: false,
  perform: async () => {},
  loadCandidate: async () => new Blob(),
});

export type ReaderAssistantThreadProps = {
  jobId?: string;
  messages?: readonly ReaderAskStoreMessage[];
  citationsByMessageId?: Record<string, AiCitationLike[]>;
  progressByMessageId?: Record<string, string>;
  contentByMessageId?: Record<string, string>;
  streamingAssistantId?: string;
  isRunning?: boolean;
  onSubmit: (question: string) => void | Promise<void>;
  onRetry: (assistantMessageId: string) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onJumpCitation?: (citation: AiCitationLike) => void;
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
  branchBusy?: boolean;
  agentOperations?: ReturnType<typeof useReaderAgentOperations>;
  assistantMode?: ReaderAssistantMode;
  onAssistantModeChange?: (mode: ReaderAssistantMode) => void;
  selectionContext?: ReaderSelection | null;
  onClearSelectionContext?: () => void;
};

function messageText(message: AppendMessage): string {
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function assistantStatus(
  message: ReaderAskStoreMessage,
  streamingAssistantId: string,
  isRunning: boolean,
): ThreadMessageLike["status"] {
  if (
    message.status?.type === "running"
    || (isRunning && streamingAssistantId === message.id)
  ) {
    return { type: "running" };
  }
  if (message.status?.type === "incomplete" || message.status?.type === "error") {
    return {
      type: "incomplete",
      reason: message.status?.reason === "cancelled" ? "cancelled" : "error",
    };
  }
  return { type: "complete", reason: "stop" };
}

export function ReaderAssistantThread({
  jobId = "",
  messages = EMPTY_MESSAGES,
  citationsByMessageId = EMPTY_CITATIONS,
  progressByMessageId = EMPTY_TEXT_BY_MESSAGE,
  contentByMessageId = EMPTY_TEXT_BY_MESSAGE,
  streamingAssistantId = "",
  isRunning = false,
  onSubmit,
  onRetry,
  onCancel,
  onJumpCitation,
  onBranchFromAnswer,
  branchBusy = false,
  agentOperations = EMPTY_AGENT_OPERATIONS,
  assistantMode = "reading",
  onAssistantModeChange,
  selectionContext = null,
  onClearSelectionContext,
}: ReaderAssistantThreadProps) {
  const [, setCredentialEpoch] = useState(0);

  useEffect(() => {
    const refresh = () => setCredentialEpoch((value) => value + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener(CREDENTIALS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener(CREDENTIALS_CHANGED_EVENT, refresh);
    };
  }, []);

  const missingLlmKey = !hasModelApiKey() && !agentOperations.runtimeCredentialConfigured;
  const runtimeMessages = useMemo<ThreadMessageLike[]>(() => messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: contentByMessageId[message.id] || message.content || "",
    ...(message.role === "assistant"
      ? { status: assistantStatus(message, streamingAssistantId, isRunning) }
      : {}),
  })), [contentByMessageId, isRunning, messages, streamingAssistantId]);

  const retryFromParent = useCallback(async (parentId: string | null) => {
    const start = parentId
      ? Math.max(0, messages.findIndex((message) => message.id === parentId) + 1)
      : 0;
    const target = messages.slice(start).find((message) => message.role === "assistant");
    if (target) await onRetry(target.id);
  }, [messages, onRetry]);

  const handleNewMessage = useCallback(async (message: AppendMessage) => {
    const question = messageText(message);
    if (!question || isRunning || branchBusy || agentOperations.runtimeRestarting || missingLlmKey) return;
    await onSubmit(question);
  }, [agentOperations.runtimeRestarting, branchBusy, isRunning, missingLlmKey, onSubmit]);

  const handleCancel = useCallback(async () => {
    await onCancel();
  }, [onCancel]);

  const runtimeStore = useMemo(() => ({
    messages: runtimeMessages,
    isRunning,
    isDisabled: branchBusy || agentOperations.runtimeRestarting || missingLlmKey,
    convertMessage: identityMessageConverter,
    onNew: handleNewMessage,
    onReload: retryFromParent,
    onCancel: handleCancel,
  }), [
    agentOperations.runtimeRestarting,
    branchBusy,
    handleCancel,
    handleNewMessage,
    isRunning,
    missingLlmKey,
    retryFromParent,
    runtimeMessages,
  ]);

  const runtime = useExternalStoreRuntime(runtimeStore);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ReaderAssistantSurface
        jobId={jobId}
        messages={messages}
        citationsByMessageId={citationsByMessageId}
        progressByMessageId={progressByMessageId}
        streamingAssistantId={streamingAssistantId}
        isRunning={isRunning}
        missingLlmKey={missingLlmKey}
        branchBusy={branchBusy}
        agentRequestBlocked={agentOperations.runtimeRestarting}
        assistantMode={assistantMode}
        onAssistantModeChange={onAssistantModeChange}
        selectionContext={selectionContext}
        onClearSelectionContext={onClearSelectionContext}
        agentOperationPanel={(
          agentOperations.entries.length > 0
          || agentOperations.runtimeRestarting
        ) ? (
          <ReaderAgentOperationPanel
            entries={agentOperations.entries}
            confirmationMode={agentOperations.confirmationMode}
            runtimeRestarting={agentOperations.runtimeRestarting}
            loadCandidate={agentOperations.loadCandidate}
            onAction={agentOperations.perform}
          />
        ) : null}
        onJumpCitation={onJumpCitation}
        onBranchFromAnswer={onBranchFromAnswer}
      />
    </AssistantRuntimeProvider>
  );
}
