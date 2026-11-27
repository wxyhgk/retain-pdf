/** 阅读页的提问窗：把主对话（use-ask-conversation）、下一问的出处、任务号、跳页、KaTeX 地址接到 @retainpdf/ask 的 AskWindow 上。
 * 单独一块，第一次提问才加载。以前按书存的问答（只读）也用它看。 */
import { useEffect, useMemo, useState, type ReactElement } from "react";
import AskWindow from "@retainpdf/ask/window";
import type { AskAnswerAction, AskAttachTool, AskContextOffer, AskMessageContext } from "@retainpdf/ask";
import type { AskConversationRecord } from "@retainpdf/api/ai";
import { Archive, BookmarkCheck, ChevronRight, History, Loader2 } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import { resolveKatexStylesheetUrl } from "../external.js";
import { bindAskPort, toAskContext } from "./ask-context.js";
import { anchorSelection, contextBlock, contextSelection, selectionAnchor, suggestedTranslation, type AskBook } from "./conversation-messages.js";
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
  /** 回答底下的「改这段译文」：跳到问的那一块、打开编辑框，draft 是回答里建议的译文（没有是 null）。不给（这本书现在不能改）就没有。 */
  onEditBlock?: ((itemId: string, draft: string | null) => void) | null;
  /** 这一块能不能改（表格这类不能改）。 */
  canEditBlock?: (itemId: string) => boolean;
  /** 已经带着出处时书页上又选了一处：换成它还是再加上它。 */
  contextOffer?: AskContextOffer | null;
  /** 输入框那一行的「带上这一页」。 */
  attachTools?: readonly AskAttachTool[];
  /** 「截一块问」截好的图：id 变了就加进输入框。 */
  attachRequest?: { id: number; files: readonly File[] } | null;
  /** 窗口摆法变了（贴右边时宽多少）：阅读页给书页让出右边。 */
  onLayout?: (layout: { mode: string; width: number }) => void;
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

/** 归档了的主对话叫什么：有自己的标题写标题，日期是最后一次说话那天。 */
function archivedLabel(record: AskConversationRecord): string {
  const title = record.title && record.title !== "主对话" ? `${record.title} · ` : "";
  return `${title}${record.updated_at.slice(0, 10)}`;
}

function Breadcrumb({ ask }: { ask: AskState }): ReactElement {
  const conversation = ask.view.conversation;
  if (conversation?.kind === "main" && conversation.status === "archived") {
    return (
      <span className="ask-crumbs">
        <Button className="ask-crumb-link" title="回这本书现在的主对话" onClick={() => void ask.backToMain()}>主对话</Button>
        <ChevronRight size={11} aria-hidden />
        <span className="ask-crumb" title={`归档了的主对话，只能看（${conversation.message_count} 条）`}>以前的对话 · {archivedLabel(conversation)}</span>
      </span>
    );
  }
  if (conversation?.kind !== "side") return <span className="ask-crumb" title="一直延续的主对话：换书、换 agent 都接着聊">主对话</span>;
  return (
    <span className="ask-crumbs">
      <Button className="ask-crumb-link" title="回主对话（副对话留着，之后能回来）" onClick={() => void ask.backToMain()}>主对话</Button>
      <ChevronRight size={11} aria-hidden />
      <span className="ask-crumb" title={conversation.title}>{conversation.title || "副对话"}</span>
    </span>
  );
}

/** 归档：先在标题栏里问一句（以前点了就归档，手滑就丢了这一长串）；归档的在「以前的对话」里还能看。 */
function ArchiveButton({ onArchive }: { onArchive: () => Promise<void> }): ReactElement {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), 6000);
    return () => clearTimeout(timer);
  }, [confirming]);
  if (!confirming) {
    return (
      <Button className="ask-icon" aria-label="归档主对话" title="归档这个主对话，开一个新的（归档的在「以前的对话」里还能看，记忆不受影响）" onClick={() => setConfirming(true)}>
        <Archive size={14} aria-hidden />
      </Button>
    );
  }
  return (
    <span className="reader-ask-confirm" role="group" aria-label="确认归档">
      <span>归档并开新的？</span>
      <Button
        className="reader-ask-confirm-yes"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onArchive();
          } finally {
            setBusy(false);
            setConfirming(false);
          }
        }}
      >
        {busy ? <Loader2 size={12} className="ask-spin" aria-hidden /> : null}
        归档
      </Button>
      <Button className="reader-ask-confirm-no" onClick={() => setConfirming(false)}>取消</Button>
    </span>
  );
}

/** 「以前的对话」：这本书归档了的主对话，点一个只读地看。 */
function ArchivedMenu({ ask }: { ask: AskState }): ReactElement {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<AskConversationRecord[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError("");
    ask.listArchived().then(
      (records) => !cancelled && setList(records),
      (failure) => !cancelled && setError(failure instanceof Error ? failure.message : String(failure)),
    );
    return () => {
      cancelled = true;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = ask.view.conversation?.conversation_id;
  return (
    <details className="ask-install reader-ask-history" open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
      <summary className="ask-icon" aria-label="以前的对话" title="以前的对话：这本书归档了的主对话">
        <History size={14} aria-hidden />
      </summary>
      <ul>
        {error ? <li className="reader-ask-history-note">{error}</li> : list === null ? <li className="reader-ask-history-note">在读……</li> : list.length ? list.map((record) => (
          <li key={record.conversation_id}>
            <Button
              className="reader-ask-history-item"
              data-current={record.conversation_id === shown ? "true" : undefined}
              onClick={() => {
                setOpen(false);
                void ask.viewArchived(record);
              }}
            >
              <span>{archivedLabel(record)}</span>
              <small>{record.message_count} 条</small>
            </Button>
          </li>
        )) : <li className="reader-ask-history-note">这本书还没有归档过的对话。</li>}
      </ul>
    </details>
  );
}

export default function ReaderAskPanel({ port, jobId, bookTitle, book, ask, onShowSelection, onJumpToPage, pageCount, legacy, onLayout, onEditBlock, canEditBlock, attachTools, attachRequest, contextOffer }: ReaderAskPanelProps): ReactElement {
  const [memoryOpen, setMemoryOpen] = useState(false);
  const conversation = ask.view.conversation;
  const bound = legacy ? null : conversation ? { id: conversation.conversation_id, documentId: book.documentId } : null;
  const askPort = useMemo(() => bindAskPort(port, jobId, bound), [port, jobId, bound?.id, bound?.documentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = legacy ? null : ask.pending;
  const extras = ask.extras;
  const context = useMemo(() => (pending ? toAskContext(pending, jobId, bookTitle, anchorSelection(pending, book), extras) : null), [pending, jobId, bookTitle, book, extras]);
  const showContext = onShowSelection
    ? (target: AskMessageContext) => {
      // 读回来的是出处本身，这次刚问的是发问时的 _meta（11-27 以前这种点了不跳）。
      const selection = contextSelection(target);
      if (!selection || (selection.document_id && book.documentId && selection.document_id !== book.documentId)) return;
      onShowSelection({ page: selection.page, pane: selection.pane === "source" ? "source" : "translated" });
    }
    : undefined;
  const documentId = book.documentId;
  const answerAction = useMemo<AskAnswerAction | undefined>(() => (onEditBlock ? {
    label: "改这段译文",
    title: "改问的这段译文：回答里选着一段字就先填进去（不然填回答里的 ```译文 代码块），存之前还能改",
    available: (target) => {
      const itemId = contextBlock(target, documentId);
      return Boolean(itemId && (!canEditBlock || canEditBlock(itemId)));
    },
    run: (target, answer) => {
      const itemId = contextBlock(target, documentId);
      if (itemId) onEditBlock(itemId, suggestedTranslation(answer));
    },
  } : undefined), [onEditBlock, canEditBlock, documentId]);
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
        onLayout={onLayout}
      />
    );
  }
  const main = conversation?.kind === "main" && conversation.status !== "archived";
  const archived = conversation?.kind === "main" && conversation.status === "archived";
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
      readOnly={archived}
      title={<Breadcrumb ask={ask} />}
      headerActions={<>
        {memories ? (
          <Button className="ask-icon" aria-label="记忆" title="记忆：AI 记下的、你自己加的（能关掉）" onClick={() => setMemoryOpen(true)}>
            <BookmarkCheck size={14} aria-hidden />
          </Button>
        ) : null}
        {ask.persistent && port.conversations?.archived ? <ArchivedMenu ask={ask} /> : null}
        {main && ask.persistent ? <ArchiveButton onArchive={ask.archiveMain} /> : null}
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
      onRewrite={ask.persistent ? async (questionId) => {
        // 改一问、重新回答：后端作废它和之后的；这一问照用原来的出处。
        const selection = await ask.rewrite(questionId);
        return selection ? toAskContext(selectionAnchor(selection), jobId, bookTitle, { ...selection, item_ids: selection.item_ids || [] }) : null;
      } : undefined}
      memories={ask.notices}
      onJumpToPage={onJumpToPage}
      pageCount={pageCount}
      katexStylesheetUrl={katex}
      onLayout={onLayout}
      answerAction={answerAction}
      attachTools={attachTools}
      attachRequest={attachRequest}
      contextOffer={contextOffer}
    />
    {memories ? <ReaderMemoryPanel port={memories} glossaries={port.glossaries} documentId={book.documentId} open={memoryOpen} onOpenChange={setMemoryOpen} /> : null}
    </>
  );
}
