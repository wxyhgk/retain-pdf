// Reading Q&A presentation: summaries, explanations, and cited answers.
// This view never mutates the PDF; selection context stays visible here and
// PDF Agent operation UI is never rendered in this component.

import { ThreadPrimitive } from "@assistant-ui/react";
import { ArrowDown, BookOpen, FlaskConical, ListTree, Sigma, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { AiCitationLike } from "../../../external.js";
import type { ReaderSelection } from "../../../shared/data/reader-regions.js";
import {
  AssistantComposer,
  LockedComposer,
  ThreadMessageList,
} from "./reader-assistant-primitives.js";

const READING_SUGGESTIONS = [
  { prompt: "用几句话总结这篇文献的核心内容。", label: "总结本文", icon: BookOpen },
  { prompt: "这篇文献的主要结论是什么？", label: "提炼主要结论", icon: ListTree },
  { prompt: "作者用了什么方法或模型？", label: "梳理方法与模型", icon: FlaskConical },
  { prompt: "解释文中的关键公式。", label: "解释关键公式", icon: Sigma },
] as const;

export type ReaderReadingViewProps = {
  jobId: string;
  empty: boolean;
  citationsByMessageId: Record<string, AiCitationLike[]>;
  progressByMessageId: Record<string, string>;
  streamingAssistantId: string;
  isRunning: boolean;
  missingLlmKey: boolean;
  branchBusy: boolean;
  composerDisabled?: boolean;
  onModeChange?: (mode: "reading" | "operations") => void;
  onJumpCitation?: (citation: AiCitationLike) => void;
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
  selectionContext?: ReaderSelection | null;
  onClearSelectionContext?: () => void;
  footerExtra?: ReactNode;
};

export function ReaderReadingView({
  jobId,
  empty,
  citationsByMessageId,
  progressByMessageId,
  streamingAssistantId,
  isRunning,
  missingLlmKey,
  branchBusy,
  composerDisabled = false,
  onModeChange,
  onJumpCitation,
  onBranchFromAnswer,
  selectionContext = null,
  onClearSelectionContext,
  footerExtra = null,
}: ReaderReadingViewProps) {
  return (
    <>
      {empty ? (
        <div className="aui-empty">
          <div className="aui-empty-mascot" aria-hidden>
            <span className="aui-empty-mascot-face">
              <Sparkles size={21} strokeWidth={1.9} />
            </span>
          </div>
          <h2 className="aui-empty-title">一起读懂这篇文档</h2>
          <p className="aui-empty-sub">总结、解释、检索与计算，不修改 PDF</p>
          <div className="aui-suggestions" role="group" aria-label="推荐问题">
            {READING_SUGGESTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <ThreadPrimitive.Suggestion
                  key={item.prompt}
                  prompt={item.prompt}
                  send
                  type="button"
                  className="aui-suggestion"
                  disabled={branchBusy || composerDisabled || missingLlmKey}
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
      {footerExtra}
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
            branchBusy={branchBusy || composerDisabled}
            mode="reading"
            onModeChange={onModeChange}
            selectionContext={selectionContext}
            onClearSelectionContext={onClearSelectionContext}
          />
        )}
      </ThreadPrimitive.ViewportFooter>
    </>
  );
}
