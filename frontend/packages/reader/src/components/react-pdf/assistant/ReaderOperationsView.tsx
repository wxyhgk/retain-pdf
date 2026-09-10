// PDF Agent presentation: explicit operation requests with candidate
// preview and confirmation. Selection quotes are never attached here;
// operations are always document-scoped.

import { ThreadPrimitive } from "@assistant-ui/react";
import { ArrowDown, FileText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { AiCitationLike } from "../../../external.js";
import {
  AssistantComposer,
  LockedComposer,
  ThreadMessageList,
} from "./reader-assistant-primitives.js";

const OPERATION_SUGGESTIONS = [
  { prompt: "把第 1 页旋转 90 度。", label: "旋转页面", icon: FileText },
  { prompt: "删除最后一页。", label: "删除页面", icon: FileText },
] as const;

export type ReaderOperationsViewProps = {
  jobId: string;
  empty: boolean;
  citationsByMessageId: Record<string, AiCitationLike[]>;
  progressByMessageId: Record<string, string>;
  streamingAssistantId: string;
  isRunning: boolean;
  missingLlmKey: boolean;
  branchBusy: boolean;
  agentRequestBlocked?: boolean;
  agentOperationPanel?: ReactNode;
  onModeChange?: (mode: "reading" | "operations") => void;
  onJumpCitation?: (citation: AiCitationLike) => void;
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
};

export function ReaderOperationsView({
  jobId,
  empty,
  citationsByMessageId,
  progressByMessageId,
  streamingAssistantId,
  isRunning,
  missingLlmKey,
  branchBusy,
  agentRequestBlocked = false,
  agentOperationPanel,
  onModeChange,
  onJumpCitation,
  onBranchFromAnswer,
}: ReaderOperationsViewProps) {
  const blocked = branchBusy || agentRequestBlocked;
  return (
    <>
      {empty ? (
        <div className="aui-empty">
          <div className="aui-empty-mascot" aria-hidden>
            <span className="aui-empty-mascot-face">
              <Sparkles size={21} strokeWidth={1.9} />
            </span>
          </div>
          <h2 className="aui-empty-title">想怎样处理 PDF？</h2>
          <p className="aui-empty-sub">创建候选版本后由你预览和确认</p>
          <div className="aui-suggestions" role="group" aria-label="推荐问题">
            {OPERATION_SUGGESTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <ThreadPrimitive.Suggestion
                  key={item.prompt}
                  prompt={item.prompt}
                  send
                  type="button"
                  className="aui-suggestion"
                  disabled={blocked || missingLlmKey}
                >
                  <Icon size={14} strokeWidth={2} aria-hidden className="aui-suggestion-icon" />
                  <span className="aui-suggestion-label">{item.label}</span>
                </ThreadPrimitive.Suggestion>
              );
            })}
          </div>
        </div>
      ) : null}
      <ThreadMessageList
        jobId={jobId}
        citationsByMessageId={citationsByMessageId}
        progressByMessageId={progressByMessageId}
        streamingAssistantId={streamingAssistantId}
        isRunning={isRunning}
        branchBusy={branchBusy}
        onJumpCitation={onJumpCitation}
        onBranchFromAnswer={onBranchFromAnswer}
      />
      {agentOperationPanel}
      <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer">
        {!empty && !branchBusy ? (
          <ThreadPrimitive.ScrollToBottom
            className="aui-scroll-bottom-btn aui-scroll-bottom"
            aria-label="滚到最新"
          >
            <ArrowDown size={16} strokeWidth={2.25} aria-hidden />
          </ThreadPrimitive.ScrollToBottom>
        ) : null}
        {missingLlmKey ? <LockedComposer /> : (
          <AssistantComposer
            isRunning={isRunning}
            branchBusy={blocked}
            mode="operations"
            onModeChange={onModeChange}
            selectionContext={null}
            onClearSelectionContext={undefined}
          />
        )}
      </ThreadPrimitive.ViewportFooter>
    </>
  );
}
