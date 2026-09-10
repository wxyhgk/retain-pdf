// Notion AI 式右侧栏：Markdown 线程 + 会话窗口 + 分支开窗

import { useCallback, useState } from "react";
import { Sparkles } from "lucide-react";
import { type AiCitationLike } from "../../external.js";
import { ReaderFloatShell } from "./ReaderFloatShell.js";
import { ReaderAssistantThread } from "./assistant/ReaderAssistantThread.js";
import { ReaderConversationBar } from "./assistant/ReaderConversationBar.js";
import { useReaderAskRuntime } from "./assistant/use-reader-ask-runtime.js";
import type { ReaderSelection } from "../../shared/data/reader-regions.js";

export type ReaderAiPanelProps = {
  open: boolean;
  jobId: string;
  documentId?: string;
  onClose: () => void;
  /** page_idx 为 0 基；由阅读器 goToPage(page_idx+1) */
  onJumpCitation: (citation: AiCitationLike) => void;
  onDocumentCommitted?: (input: { documentId: string; revision: string }) => void;
  layout?: "floating" | "docked" | "workspace";
  side?: "left" | "right";
  selectionContext?: ReaderSelection | null;
  onClearSelectionContext?: () => void;
};

export function ReaderAiPanel({
  open,
  jobId,
  documentId = "",
  onClose,
  onJumpCitation,
  onDocumentCommitted,
  layout = "floating",
  side = "right",
  selectionContext = null,
  onClearSelectionContext,
}: ReaderAiPanelProps) {
  // AI 由后端统一选择结构化文档、Markdown 兼容检索或 PDF 操作。
  // jobId 只证明当前文档已有可用的处理产物。
  const enabled = open && Boolean(jobId);
  const {
    citationsByMessageId,
    progressByMessageId,
    contentByMessageId,
    streamingAssistantId,
    isRunning,
    sessions,
    activeConversationId,
    sessionBusy,
    sessionError,
    messages,
    submitQuestion,
    retryAnswer,
    cancelAnswer,
    newSession,
    switchSession,
    removeSession,
    renameSession,
    branchFromAnswer,
    agentOperations,
    assistantMode,
    setAssistantMode,
  } = useReaderAskRuntime({
    jobId,
    documentId,
    enabled,
    selectionContext,
    onDocumentCommitted,
  });

  const [branchNotice, setBranchNotice] = useState("");

  const handleBranch = useCallback(async (assistantId: string) => {
    setBranchNotice("");
    const ok = await branchFromAnswer(assistantId);
    if (ok) {
      setBranchNotice(
        "已保存新对话（fork-n-原名）：复制了到此答案的上文，原对话不变。顶部列表可切换。",
      );
      window.setTimeout(() => setBranchNotice(""), 6000);
    }
  }, [branchFromAnswer]);

  // Session switching already owns the short-lived document click shield.
  // Citation callbacks must not add another lock or legitimate clicks can vanish.
  const safeJumpCitation = useCallback((citation: AiCitationLike) => {
    onJumpCitation(citation);
  }, [onJumpCitation]);

  return (
    <ReaderFloatShell
      id="reader-ai-panel"
      open={open}
      title="RetainPDF AI"
      titleIcon={<Sparkles size={14} strokeWidth={2.1} aria-hidden />}
      storageKey="retainpdf.reader.ai-float.pos.v2"
      ariaLabel="阅读问答"
      width={420}
      placement={layout === "workspace" ? "workspace" : layout === "docked" ? "dock-right" : "floating"}
      showHeader={layout !== "workspace"}
      className={`reader-float-ai is-${layout}${layout === "workspace" ? ` is-pane-${side}` : ""}${sessionBusy ? " is-session-busy" : ""}`}
      onClose={onClose}
    >
      {!jobId ? (
        <div className="reader-float-ai-empty">
          <Sparkles size={22} strokeWidth={1.75} aria-hidden />
          <p>当前文档还没有可用于 AI 的解析产物</p>
          <span>请先完成 OCR 文档解析</span>
        </div>
      ) : (
        <div className="reader-float-ai-body">
          <ReaderConversationBar
            sessions={sessions}
            activeId={activeConversationId}
            busy={sessionBusy}
            errorText={sessionError}
            onSwitch={switchSession}
            onNew={newSession}
            onDelete={removeSession}
            onRename={renameSession}
          />
          {branchNotice ? (
            <div className="aui-session-banner" role="status">
              {branchNotice}
            </div>
          ) : null}
          <div className="reader-float-ai-thread-wrap" aria-busy={sessionBusy || undefined}>
            <ReaderAssistantThread
              jobId={jobId}
              messages={messages}
              citationsByMessageId={citationsByMessageId}
              progressByMessageId={progressByMessageId}
              contentByMessageId={contentByMessageId}
              streamingAssistantId={streamingAssistantId}
              isRunning={isRunning}
              onSubmit={submitQuestion}
              onRetry={retryAnswer}
              onCancel={cancelAnswer}
              onJumpCitation={safeJumpCitation}
              onBranchFromAnswer={handleBranch}
              branchBusy={sessionBusy}
              agentOperations={agentOperations}
              assistantMode={assistantMode}
              onAssistantModeChange={setAssistantMode}
              selectionContext={selectionContext}
              onClearSelectionContext={onClearSelectionContext}
            />
          </div>
        </div>
      )}
    </ReaderFloatShell>
  );
}
