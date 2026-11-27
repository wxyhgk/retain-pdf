/** 阅读页的提问窗：把主对话（use-ask-conversation）、下一问的出处、任务号、跳页、KaTeX 地址接到 @retainpdf/ask 的 AskWindow 上。
 * 单独一块，第一次提问才加载。以前按书存的问答（只读）也用它看。 */
import { useMemo, useState, type ReactElement } from "react";
import AskWindow from "@retainpdf/ask/window";
import type { AskAnswerAction, AskAttachTool, AskContextOffer, AskMessageContext } from "@retainpdf/ask";
import { BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import { resolveKatexStylesheetUrl } from "../external.js";
import { bindAskPort, toAskContext } from "./ask-context.js";
import { anchorSelection, contextBlock, contextSelection, selectionAnchor, suggestedTranslation, type AskBook } from "./conversation-messages.js";
import { ReaderAskConversationMenu } from "./ReaderAskConversationMenu.js";
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
  /** 阅读页右边停着面板（Markdown）：刚停上时贴右边的提问窗变回浮动。 */
  dockTaken?: boolean;
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

export default function ReaderAskPanel({ port, jobId, bookTitle, book, ask, onShowSelection, onJumpToPage, pageCount, legacy, onLayout, dockTaken, onEditBlock, canEditBlock, attachTools, attachRequest, contextOffer }: ReaderAskPanelProps): ReactElement {
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
        dockTaken={dockTaken}
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
      title={<ReaderAskConversationMenu ask={ask} canArchive={main} canList={Boolean(port.conversations?.archived)} />}
      headerMenu={memories ? [{
        key: "memory",
        label: "记忆",
        hint: "AI 记住的关于你和这本书的事，能改、删、关掉",
        icon: <BookmarkCheck size={14} aria-hidden />,
        onSelect: () => setMemoryOpen(true),
      }] : undefined}
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
      dockTaken={dockTaken}
      answerAction={answerAction}
      attachTools={attachTools}
      attachRequest={attachRequest}
      contextOffer={contextOffer}
    />
    {memories ? <ReaderMemoryPanel port={memories} glossaries={port.glossaries} documentId={book.documentId} open={memoryOpen} onOpenChange={setMemoryOpen} /> : null}
    </>
  );
}
