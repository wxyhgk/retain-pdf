// Thin viewport shell for the Reader assistant thread. Reading Q&A and
// PDF Agent render through their explicit views; this file only owns the
// shared assistant-ui viewport chrome and routes by mode.

import { ThreadPrimitive } from "@assistant-ui/react";
import type { ReactNode } from "react";
import type { AiCitationLike } from "../../../external.js";
import type { ReaderAskStoreMessage } from "./reader-ask-tree.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
import type { ReaderSelection } from "../../../shared/data/reader-regions.js";
import { ReaderOperationsView } from "./ReaderOperationsView.js";
import { ReaderReadingView } from "./ReaderReadingView.js";

export type ReaderAssistantSurfaceProps = {
  jobId: string;
  messages: readonly ReaderAskStoreMessage[];
  citationsByMessageId: Record<string, AiCitationLike[]>;
  progressByMessageId: Record<string, string>;
  streamingAssistantId: string;
  isRunning: boolean;
  missingLlmKey: boolean;
  branchBusy: boolean;
  agentRequestBlocked?: boolean;
  agentOperationPanel?: ReactNode;
  assistantMode?: ReaderAssistantMode;
  onAssistantModeChange?: (mode: ReaderAssistantMode) => void;
  onJumpCitation?: (citation: AiCitationLike) => void;
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
  selectionContext?: ReaderSelection | null;
  onClearSelectionContext?: () => void;
};

export function ReaderAssistantSurface({
  jobId,
  messages,
  citationsByMessageId,
  progressByMessageId,
  streamingAssistantId,
  isRunning,
  missingLlmKey,
  branchBusy,
  agentRequestBlocked = false,
  agentOperationPanel,
  assistantMode = "reading",
  onAssistantModeChange,
  onJumpCitation,
  onBranchFromAnswer,
  selectionContext = null,
  onClearSelectionContext,
}: ReaderAssistantSurfaceProps) {
  const empty = messages.length === 0;
  const operationsMode = assistantMode === "operations";
  return (
    <ThreadPrimitive.Root
      className={`aui-thread aui-thread-root${missingLlmKey ? " is-llm-locked" : ""}`}
      data-chat-ui="assistant-ui-official-thread"
    >
      <ThreadPrimitive.Viewport
        className="aui-viewport"
        data-slot="aui_thread-viewport"
        data-reader-ai-viewport="true"
        turnAnchor="top"
        autoScroll
      >
        <div className={`aui-thread-inner${empty ? " is-empty" : ""}`}>
          {operationsMode ? (
            <ReaderOperationsView
              jobId={jobId}
              empty={empty}
              citationsByMessageId={citationsByMessageId}
              progressByMessageId={progressByMessageId}
              streamingAssistantId={streamingAssistantId}
              isRunning={isRunning}
              missingLlmKey={missingLlmKey}
              branchBusy={branchBusy}
              agentRequestBlocked={agentRequestBlocked}
              agentOperationPanel={agentOperationPanel}
              onModeChange={onAssistantModeChange}
              onJumpCitation={onJumpCitation}
              onBranchFromAnswer={onBranchFromAnswer}
            />
          ) : (
            <ReaderReadingView
              jobId={jobId}
              empty={empty}
              citationsByMessageId={citationsByMessageId}
              progressByMessageId={progressByMessageId}
              streamingAssistantId={streamingAssistantId}
              isRunning={isRunning}
              missingLlmKey={missingLlmKey}
              branchBusy={branchBusy}
              composerDisabled={agentRequestBlocked}
              onModeChange={onAssistantModeChange}
              onJumpCitation={onJumpCitation}
              onBranchFromAnswer={onBranchFromAnswer}
              selectionContext={selectionContext}
              onClearSelectionContext={onClearSelectionContext}
            />
          )}
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
