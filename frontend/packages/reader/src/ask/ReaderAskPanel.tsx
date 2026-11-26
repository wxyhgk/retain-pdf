/** 阅读页的提问窗：把主对话（use-ask-conversation）、下一问的出处、任务号、跳页、KaTeX 地址接到 @retainpdf/ask 的 AskWindow 上。
 * 单独一块，第一次提问才加载。以前按书存的问答（只读）也用它看。 */
import { useMemo, useState, type ReactElement } from "react";
import AskWindow from "@retainpdf/ask/window";
import type { AskMessageContext } from "@retainpdf/ask";
import type { AskSelectionRecord } from "@retainpdf/api/ai";
import { Archive, BookmarkCheck, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import { resolveKatexStylesheetUrl } from "../external.js";
import { bindAskPort, toAskContext } from "./ask-context.js";
import { anchorSelection, type AskBook } from "./conversation-messages.js";
import { ReaderMemoryPanel } from "./ReaderMemoryPanel.js";
import type { useAskConversation } from "./use-ask-conversation.js";

type AskState = ReturnType<typeof useAskConversation>;

export type ReaderAskPanelProps = {
  port: ReaderAskPort;
  jobId: string;
  bookTitle?: string;
  book: AskBook;
  ask: AskState;
  /** 点问题上面的小标签：回到问的那一处（只认这本书里的）。 */
  onShowSelection?: (selection: { page: number; pane: "source" | "translated" }) => void;
  onJumpToPage?: (page: number) => void;
  pageCount?: number;
  /** 以前按书存的一次提问（只读看）；给了就不画主对话。 */
  legacy?: { anchor: ReaderAskAnchor; messages: readonly ReaderAskMessage[]; onClose: () => void; onDelete?: () => void } | null;
};

function SideBar({ ask }: { ask: AskState }): ReactElement | null {
  const side = ask.view.conversation;
  if (side?.kind !== "side") return null;
  if (side.status !== "open") return <p className="ask-side-bar" data-state="closed">这个副对话已经结束，结论在主对话里；接着问会重新打开它。</p>;
  return (
    <div className="ask-side-bar" data-state={ask.closingSide}>
      <span>{ask.closingSide === "busy" ? "正在把这段来回总结成结论……" : ask.closingSide === "failed" ? "结论没写成（模型出错或没配模型）。" : "聊完了？结论会带回主对话。"}</span>
      <Button className="ask-side-close" onClick={() => void ask.closeSide()} disabled={ask.closingSide === "busy"}>
        {ask.closingSide === "busy" ? <Loader2 size={12} className="ask-spin" aria-hidden /> : null}
        {ask.closingSide === "failed" ? "再试一次" : "结束，带回结论"}
      </Button>
    </div>
  );
}

function Breadcrumb({ ask }: { ask: AskState }): ReactElement {
  const conversation = ask.view.conversation;
  if (conversation?.kind !== "side") return <span className="ask-crumb" title="一直延续的主对话：换书、换 agent 都接着聊">主对话</span>;
  return (
    <span className="ask-crumbs">
      <Button className="ask-crumb-link" title="回主对话（副对话留着，之后能回来）" onClick={() => void ask.backToMain()}>主对话</Button>
      <ChevronRight size={11} aria-hidden />
      <span className="ask-crumb" title={conversation.title}>{conversation.title || "副对话"}</span>
    </span>
  );
}

export default function ReaderAskPanel({ port, jobId, bookTitle, book, ask, onShowSelection, onJumpToPage, pageCount, legacy }: ReaderAskPanelProps): ReactElement {
  const [memoryOpen, setMemoryOpen] = useState(false);
  const conversation = ask.view.conversation;
  const bound = legacy ? null : conversation ? { id: conversation.conversation_id, documentId: book.documentId } : null;
  const askPort = useMemo(() => bindAskPort(port, jobId, bound), [port, jobId, bound?.id, bound?.documentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = legacy ? null : ask.pending;
  const context = useMemo(() => (pending ? toAskContext(pending, jobId, bookTitle, anchorSelection(pending, book)) : null), [pending, jobId, bookTitle, book]);
  const showContext = onShowSelection
    ? (target: AskMessageContext) => {
      const selection = target.data as AskSelectionRecord | undefined;
      if (!selection?.page || (selection.document_id && book.documentId && selection.document_id !== book.documentId)) return;
      onShowSelection({ page: selection.page, pane: selection.pane === "source" ? "source" : "translated" });
    }
    : undefined;
  const katex = resolveKatexStylesheetUrl() || undefined;
  if (legacy) {
    return (
      <AskWindow
        key={`legacy:${legacy.anchor.page}:${legacy.messages.length}`}
        port={askPort}
        context={null}
        title={<span className="ask-crumb" title="2026-11-26 以前按书存的提问，只能看；新的问题都在主对话里">以前的提问 · 第 {legacy.anchor.page} 页</span>}
        initialMessages={legacy.messages}
        readOnly
        onClose={legacy.onClose}
        onDelete={legacy.onDelete}
        onJumpToPage={onJumpToPage}
        pageCount={pageCount}
        katexStylesheetUrl={katex}
      />
    );
  }
  const main = conversation?.kind === "main";
  const memories = port.memories ?? null;
  return (
    <>
    <AskWindow
      key={ask.view.key}
      port={askPort}
      context={context}
      onContextUsed={() => ask.setPending(null)}
      onContextClear={() => ask.setPending(null)}
      onClose={ask.close}
      title={<Breadcrumb ask={ask} />}
      headerActions={<>
        {memories ? (
          <Button className="ask-icon" aria-label="记忆" title="记忆：AI 记下的、你自己加的（能关掉）" onClick={() => setMemoryOpen(true)}>
            <BookmarkCheck size={14} aria-hidden />
          </Button>
        ) : null}
        {main && ask.persistent ? (
          <Button className="ask-icon" aria-label="归档主对话" title="归档这个主对话，开一个新的（归档的还在，记忆不受影响）" onClick={() => void ask.archiveMain()}>
            <Archive size={14} aria-hidden />
          </Button>
        ) : null}
      </>}
      footer={<>
        {ask.error ? <p className="ask-error">{ask.error}</p> : null}
        <SideBar ask={ask} />
      </>}
      onShowContext={showContext}
      initialMessages={ask.view.initial}
      earlier={ask.view.hasMore ? { loading: ask.loading, load: () => void ask.loadEarlier() } : null}
      onTurn={ask.persistent ? ask.onTurn : undefined}
      onFork={main && ask.persistent ? (message) => void ask.fork(message) : undefined}
      onOpenSide={ask.persistent ? (sideId) => void ask.openSide(sideId) : undefined}
      onForgetMemory={ask.forgetMemory}
      memories={ask.notices}
      onJumpToPage={onJumpToPage}
      pageCount={pageCount}
      katexStylesheetUrl={katex}
    />
    {memories ? <ReaderMemoryPanel port={memories} documentId={book.documentId} open={memoryOpen} onOpenChange={setMemoryOpen} /> : null}
    </>
  );
}
