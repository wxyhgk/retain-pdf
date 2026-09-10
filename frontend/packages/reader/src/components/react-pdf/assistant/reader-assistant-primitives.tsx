// Small shared presentation primitives for the Reader assistant thread.
// Reading and operations views compose these; neither view owns runtime or
// backend state.

import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type MessageState,
} from "@assistant-ui/react";
import {
  ArrowUp,
  BookOpen,
  Copy,
  GitBranch,
  Image,
  Loader2,
  RefreshCw,
  Sigma,
  Sparkles,
  Square,
  Table2,
  Type,
  X,
} from "lucide-react";
import { MISSING_MODEL_API_KEY_MESSAGE } from "../../../external.js";
import { armReaderAiClickShield, lockReaderAiNavigation } from "../../../external.js";
import type { AiCitationLike } from "../../../external.js";
import { AiMarkdownAnswer } from "../../ai/AiMarkdownAnswer.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
import {
  readerRegionContent,
  type ReaderSelection,
} from "../../../shared/data/reader-regions.js";

export function assistantMessageText(message: Pick<MessageState, "content">): string {
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function ThinkingRow({ label }: { label: string }) {
  return (
    <div className="aui-thinking" role="status" aria-live="polite">
      <Loader2 className="aui-spin" size={14} strokeWidth={2.4} aria-hidden />
      <span>{label || "思考中…"}</span>
    </div>
  );
}

export function UserMessageRow({ message }: { message: MessageState }) {
  return (
    <MessagePrimitive.Root className="aui-msg aui-msg-user" data-role="user">
      <div className="aui-msg-bubble">
        <div className="aui-md-plain">{assistantMessageText(message)}</div>
      </div>
    </MessagePrimitive.Root>
  );
}

export type AssistantMessageRowProps = {
  jobId: string;
  message: MessageState;
  citations: AiCitationLike[];
  progress: string;
  streaming: boolean;
  branchBusy: boolean;
  onJumpCitation?: (citation: AiCitationLike) => void;
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
};

export function AssistantMessageRow({
  jobId,
  message,
  citations,
  progress,
  streaming,
  branchBusy,
  onJumpCitation,
  onBranchFromAnswer,
}: AssistantMessageRowProps) {
  const content = assistantMessageText(message);
  return (
    <MessagePrimitive.Root className="aui-msg aui-msg-assistant" data-role="assistant">
      <div className="aui-msg-stack">
        {streaming && progress ? <ThinkingRow label={progress} /> : null}
        {streaming && !progress && !content ? <ThinkingRow label="思考中…" /> : null}
        {content ? (
          <div className="aui-msg-bubble">
            <AiMarkdownAnswer
              content={content}
              streaming={streaming}
              citations={citations}
              jobId={jobId}
              className="aui-md"
              streamingClassName="aui-md-streaming"
              pendingClassName="aui-md-pending"
              finalClassName="aui-md-final"
              onJumpCitation={onJumpCitation}
            />
          </div>
        ) : null}
        <ActionBarPrimitive.Root
          className="aui-msg-actions"
          data-reader-ai-actions=""
          hideWhenRunning
          autohide="not-last"
        >
          <ActionBarPrimitive.Copy className="aui-action-btn" aria-label="复制答案" title="复制答案">
            <Copy size={14} strokeWidth={2.1} aria-hidden />
          </ActionBarPrimitive.Copy>
          {onBranchFromAnswer ? (
            <button
              type="button"
              className="aui-action-btn aui-action-btn-branch"
              aria-label="从这里开新对话"
              title="从这里开新对话"
              disabled={branchBusy}
              onClick={async () => {
                armReaderAiClickShield(1200, { overlayDelayMs: 0 });
                lockReaderAiNavigation(1200);
                await onBranchFromAnswer(message.id);
              }}
            >
              <GitBranch size={14} strokeWidth={2.2} aria-hidden />
            </button>
          ) : null}
          <ActionBarPrimitive.Reload className="aui-action-btn" aria-label="重新生成" title="重新生成">
            <RefreshCw size={14} strokeWidth={2.2} aria-hidden />
          </ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

export function ThreadMessageList({
  jobId,
  citationsByMessageId,
  progressByMessageId,
  streamingAssistantId,
  isRunning,
  branchBusy,
  onJumpCitation,
  onBranchFromAnswer,
}: {
  jobId: string;
  citationsByMessageId: Record<string, AiCitationLike[]>;
  progressByMessageId: Record<string, string>;
  streamingAssistantId: string;
  isRunning: boolean;
  branchBusy: boolean;
  onJumpCitation?: (citation: AiCitationLike) => void;
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
}) {
  return (
    <div className="aui-message-group" data-slot="aui_message-group">
      <ThreadPrimitive.Messages>
        {({ message }) => {
          if (message.role === "user") return <UserMessageRow message={message} />;
          if (message.role !== "assistant") return null;
          const streaming = message.status?.type === "running"
            || (isRunning && streamingAssistantId === message.id);
          return (
            <AssistantMessageRow
              jobId={jobId}
              message={message}
              citations={citationsByMessageId[message.id] || []}
              progress={progressByMessageId[message.id] || ""}
              streaming={streaming}
              branchBusy={branchBusy}
              onJumpCitation={onJumpCitation}
              onBranchFromAnswer={onBranchFromAnswer}
            />
          );
        }}
      </ThreadPrimitive.Messages>
    </div>
  );
}

export function ModeSwitch({
  mode,
  disabled,
  onChange,
}: {
  mode: ReaderAssistantMode;
  disabled: boolean;
  onChange?: (mode: ReaderAssistantMode) => void;
}) {
  return (
    <div className="aui-assistant-mode" role="group" aria-label="AI 模式">
      <button
        type="button"
        className={mode !== "operations" ? "is-active" : ""}
        aria-pressed={mode !== "operations"}
        disabled={disabled}
        onClick={() => onChange?.("reading")}
      >
        <BookOpen size={12} strokeWidth={2.2} aria-hidden />
        <span>阅读问答</span>
      </button>
      <button
        type="button"
        className={mode === "operations" ? "is-active" : ""}
        aria-pressed={mode === "operations"}
        disabled={disabled}
        onClick={() => onChange?.("operations")}
      >
        <Sparkles size={12} strokeWidth={2.2} aria-hidden />
        <span>PDF Agent</span>
      </button>
    </div>
  );
}

export function SelectionBanner({
  selectionContext,
  onClear,
}: {
  selectionContext?: ReaderSelection | null;
  onClear?: () => void;
}) {
  if (!selectionContext) return null;
  const kind = selectionContext.selectionType === "text" ? "text" : selectionContext.kind;
  const text = selectionContext.selectionType === "text"
    ? selectionContext.quote
    : readerRegionContent(selectionContext.region, selectionContext.pane);
  const label = kind === "formula" ? "公式"
    : kind === "table" ? "表格"
      : kind === "figure" ? "图片"
        : "文字";
  const SelectionIcon = kind === "formula" ? Sigma
    : kind === "table" ? Table2
      : kind === "figure" ? Image : Type;
  return (
    <div className="aui-selection-context" data-reader-ai-selection-context="">
      <SelectionIcon size={14} strokeWidth={2.1} aria-hidden />
      <span className="aui-selection-context-meta">
        {selectionContext.pane === "translated" ? "译文" : "原文"} · {selectionContext.page} 页 · {label}
      </span>
      <span className="aui-selection-context-text">{text || "已选择此区域"}</span>
      <button
        type="button"
        className="aui-selection-context-remove"
        aria-label="移除选区上下文"
        title="移除选区"
        onClick={onClear}
      >
        <X size={13} strokeWidth={2.4} aria-hidden />
      </button>
    </div>
  );
}

export function AssistantComposer({
  isRunning,
  branchBusy,
  mode,
  onModeChange,
  selectionContext,
  onClearSelectionContext,
}: {
  isRunning: boolean;
  branchBusy: boolean;
  mode: ReaderAssistantMode;
  onModeChange?: (mode: ReaderAssistantMode) => void;
  selectionContext?: ReaderSelection | null;
  onClearSelectionContext?: () => void;
}) {
  return (
    <ComposerPrimitive.Root className="aui-composer" data-reader-ai-composer="">
      <div className="aui-composer-shell">
        {mode !== "operations" ? (
          <SelectionBanner selectionContext={selectionContext} onClear={onClearSelectionContext} />
        ) : null}
        <ComposerPrimitive.Input
          className="aui-input"
          rows={1}
          placeholder={mode === "operations" ? "描述要执行的 PDF 操作…" : "询问当前文档…"}
          aria-label={mode === "operations" ? "描述 PDF 操作" : "向文档 AI 提问"}
          autoFocus
          enterKeyHint="send"
          disabled={branchBusy}
          submitMode="enter"
        />
        <div className="aui-composer-toolbar">
          <ModeSwitch mode={mode} disabled={isRunning || branchBusy} onChange={onModeChange} />
          <div className="aui-composer-actions">
            {isRunning ? (
              <ComposerPrimitive.Cancel className="aui-send aui-send-stop" aria-label="停止生成">
                <Square size={12} strokeWidth={2.6} aria-hidden />
              </ComposerPrimitive.Cancel>
            ) : (
              <ComposerPrimitive.Send className="aui-send" aria-label="发送">
                <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
              </ComposerPrimitive.Send>
            )}
          </div>
        </div>
      </div>
      <p className="aui-hint">AI 可能会出错，请核对原文与引用</p>
    </ComposerPrimitive.Root>
  );
}

export function LockedComposer() {
  return (
    <div className="aui-composer aui-composer-locked" role="alert">
      <p className="aui-llm-lock-msg">{MISSING_MODEL_API_KEY_MESSAGE}</p>
      <p className="aui-hint">请到首页「设置 → API 设置」填写模型 Key 后即可提问</p>
    </div>
  );
}
