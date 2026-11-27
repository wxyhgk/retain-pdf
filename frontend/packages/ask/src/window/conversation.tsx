/** 提问窗里跟「一直延续的对话」有关的几块（2026-11-26 主对话）：插进 Thread 的插槽，数据从 AskConversationContext 拿。
 *
 * - 输入框上面：这一问带的出处（「第 56 页 · 选中 37 字」，× 去掉；点开看引的那段）。宿主在发问那一刻读，发出去以后清掉。
 * - 问题上面：这一问问的是哪儿（小标签，点了回到那一处）。
 * - 消息最上面：「看更早的」。
 * - 回答底下：「深挖」（开副对话）；副对话的结论卡片能「看副对话」。
 * - 回答正文下面：agent 这一轮记下的记忆画成「已记住：……（撤销）」（工具卡片收起来也看得到）；压缩点画一条分隔线。
 */
import { createContext, useContext, useMemo, useState, type ReactElement } from "react";
import { useAuiState } from "@assistant-ui/react";
import { BookmarkCheck, ChevronUp, GitBranch, Loader2, MapPin, MessagesSquare, PencilLine, SquarePen, Undo2, X } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { AskAnswerAction, AskContext, AskContextOffer, AskMemoryNotice, AskMessage, AskMessageContext } from "../contract.js";
import { AskQuote } from "./AskQuote.js";

export type AskConversationUi = {
  /** 下一问要带的出处；没有是 null。 */
  pending: AskContext | null;
  clearPending?: () => void;
  /** 发出去的问题问的是哪儿（按消息编号）。 */
  contexts: ReadonlyMap<string, AskMessageContext>;
  showContext?: (context: AskMessageContext) => void;
  /** 「看更早的」；没有更早的是 null。 */
  earlier?: { loading: boolean; load: () => void } | null;
  /** 「深挖」：从这条回答开副对话。 */
  fork?: (message: { id?: string; text: string }) => void;
  /** 结论卡片的「看副对话」。 */
  openSide?: (sideId: string) => void;
  /** 「已记住」的撤销。 */
  forget?: (memoryId: string) => Promise<void>;
  /** 宿主事后查到的记忆（agent 不在工具卡片的 _meta 里报的，比如 RetainPDF + pi），按回答的消息编号。 */
  memories?: ReadonlyMap<string, readonly AskMemoryNotice[]>;
  /** 回答底下宿主加的动作（「改这段译文」）。 */
  answerAction?: AskAnswerAction;
  /** 窗口里正选着的回答里的字（answer-quote 盯着的那段）。 */
  answerSelection?: () => string;
  /** 已经带着出处时又选了一处：换成它还是再加上它。 */
  offer?: AskContextOffer | null;
};

export const AskConversationContext = createContext<AskConversationUi>({ pending: null, contexts: new Map() });

/** 出处标签上的字：「第 56 页 · 选中 37 字」。 */
export function contextChipText(context: AskContext | AskMessageContext): string {
  const quote = (context as AskContext).quote;
  const picked = quote?.selection ? `选中 ${[...quote.selection].length} 字` : "";
  return [context.label || (context.page ? `第 ${context.page} 页` : ""), picked].filter(Boolean).join(" · ");
}

/** 输入框上面：下一问带的出处。 */
export function PendingContextBar(): ReactElement | null {
  const { pending, clearPending } = useContext(AskConversationContext);
  const [open, setOpen] = useState(false);
  if (!pending) return null;
  const hasQuote = Boolean(pending.quote?.selection || pending.quote?.source || pending.quote?.translated);
  return (
    <div className="ask-pending" data-open={open ? "1" : "0"}>
      <div className="ask-pending-chip">
        <MapPin size={12} aria-hidden />
        <Button className="ask-pending-label" title={hasQuote ? "看引的那段" : pending.label} onClick={() => setOpen((value) => !value)} disabled={!hasQuote}>
          {contextChipText(pending)}
        </Button>
        {clearPending ? (
          <Button className="ask-icon ask-pending-clear" aria-label="这一问不带出处" title="这一问不带出处" onClick={clearPending}>
            <X size={12} aria-hidden />
          </Button>
        ) : null}
      </div>
      {open && hasQuote ? <AskQuote quote={pending.quote} /> : null}
    </div>
  );
}

/** 出处下面：书页上又选了一处（不再悄悄换掉已经带着的），换成它 / 再加上它 / 不要。 */
export function ContextOfferBar(): ReactElement | null {
  const { offer, pending } = useContext(AskConversationContext);
  if (!offer || !pending) return null;
  return (
    <div className="ask-offer" role="group" aria-label="新选的一处">
      <span className="ask-offer-label" title={offer.label}>又选了 {offer.label}</span>
      <Button className="ask-offer-action" onClick={offer.replace}>换成这段</Button>
      {offer.add ? <Button className="ask-offer-action" onClick={offer.add}>再加一段</Button> : null}
      <Button className="ask-icon ask-pending-clear" aria-label="不要这段" title="不要这段" onClick={offer.dismiss}>
        <X size={12} aria-hidden />
      </Button>
    </div>
  );
}

/** 问题上面：这一问改过（「改过」，点开看原来的问和答）。 */
function RewroteTag({ rewrote }: { rewrote: { question: string; answer?: string } }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="ask-question-rewrote" title="这一问改过，原来的问答作废了（原文留着）" onClick={() => setOpen((value) => !value)}>
        <PencilLine size={11} aria-hidden />
        改过
      </Button>
      {open ? (
        <div className="ask-question-original">
          <p>原来问的：{rewrote.question}</p>
          {rewrote.answer ? <p>原来的回答：{rewrote.answer}</p> : null}
        </div>
      ) : null}
    </>
  );
}

/** 问题上面：这一问问的是哪儿；改过的再画「改过」。 */
export function QuestionContextTag(): ReactElement | null {
  const { contexts, showContext } = useContext(AskConversationContext);
  const id = useAuiState((state) => state.message.id);
  const custom = useAuiState((state) => state.message.metadata?.custom) as { context?: AskMessageContext; rewrote?: { question: string; answer?: string } } | undefined;
  const context = custom?.context || contexts.get(id);
  const rewrote = custom?.rewrote;
  if (!context && !rewrote) return null;
  if (!context) return <RewroteTag rewrote={rewrote!} />;
  return (
    <>
    {rewrote ? <RewroteTag rewrote={rewrote} /> : null}
    <Button
      className="ask-question-where"
      title={showContext ? `回到问的那一处：${context.label}` : context.label}
      onClick={showContext ? () => showContext(context) : undefined}
      disabled={!showContext}
    >
      <MapPin size={11} aria-hidden />
      {contextChipText(context)}
    </Button>
    </>
  );
}

/** 消息最上面：「看更早的」。 */
export function EarlierHistory(): ReactElement | null {
  const { earlier } = useContext(AskConversationContext);
  if (!earlier) return null;
  return (
    <div className="ask-earlier">
      <Button className="ask-earlier-more" onClick={earlier.load} disabled={earlier.loading}>
        {earlier.loading ? <Loader2 size={12} className="ask-spin" aria-hidden /> : <ChevronUp size={12} aria-hidden />}
        看更早的
      </Button>
    </div>
  );
}

type StoredCustom = { stored?: Pick<AskMessage, "id" | "marks"> };

/** 回答正文下面：这一轮记下的记忆（工具卡片的 artifact.memory）、压缩点。 */
export function MessageAfter(): ReactElement | null {
  // 选出来的要是 store 里原样的引用（每次新数组会一直重画）：取 content，再挑。
  const content = useAuiState((state) => state.message.content);
  const id = useAuiState((state) => state.message.id);
  const { memories: later } = useContext(AskConversationContext);
  const extra = later?.get(id);
  const memories = useMemo(() => {
    const fromTools = content
      .map((part) => (part.type === "tool-call" ? (part.artifact as { memory?: AskMemoryNotice } | undefined)?.memory : undefined))
      .filter((memory): memory is AskMemoryNotice => Boolean(memory));
    return [...fromTools, ...(extra || []).filter((memory) => !fromTools.some((known) => known.id === memory.id))];
  }, [content, extra]);
  const compacted = useAuiState((state) => Boolean((state.message.metadata?.custom as StoredCustom | undefined)?.stored?.marks?.compactedBefore));
  if (!memories.length && !compacted) return null;
  return (
    <div className="ask-after">
      {memories.map((memory) => <MemoryNotice key={memory.id} memory={memory} />)}
      {compacted ? (
        <div className="ask-compacted" role="separator" title="到这里为止的对话已经压缩成摘要，AI 之后看摘要；原文还在上面">
          之前的已压缩成摘要
        </div>
      ) : null}
    </div>
  );
}

/** 回答底下宿主加的动作：问题带着出处、宿主认这处才有。 */
function AnswerAction({ text }: { text: string }): ReactElement | null {
  const { answerAction, answerSelection, contexts } = useContext(AskConversationContext);
  // 这条回答的问题：前一条（问和答一对一对挨着）。
  const question = useAuiState((state) => state.thread.messages[state.message.index - 1]);
  if (!answerAction || !question || question.role !== "user") return null;
  const context = (question.metadata?.custom as { context?: AskMessageContext } | undefined)?.context || contexts.get(question.id);
  if (!context || !answerAction.available(context)) return null;
  return (
    <Button
      className="ask-icon ask-answer-action"
      aria-label={answerAction.label}
      title={answerAction.title}
      onClick={() => answerAction.run(context, { text, selection: answerSelection?.() || "" })}
    >
      <SquarePen size={13} aria-hidden />
    </Button>
  );
}

/** 回答底下：「深挖」、结论卡片的「看副对话」、宿主加的动作（「改这段译文」）。 */
export function ConversationFooter(): ReactElement | null {
  const { fork, openSide } = useContext(AskConversationContext);
  const role = useAuiState((state) => state.message.role);
  const running = useAuiState((state) => state.thread.isRunning && state.message.isLast);
  const stored = useAuiState((state) => (state.message.metadata?.custom as StoredCustom | undefined)?.stored);
  const content = useAuiState((state) => state.message.content);
  const text = useMemo(() => content.map((part) => (part.type === "text" ? part.text : "")).join(""), [content]);
  if (role !== "assistant" || running) return null;
  const side = stored?.marks?.sideSummary;
  return (
    <>
      {side?.sideId && openSide ? (
        <Button className="ask-icon ask-side-open" aria-label="看副对话" title={`看副对话${side.title ? `「${side.title}」` : ""}的来回`} onClick={() => openSide(side.sideId!)}>
          <MessagesSquare size={13} aria-hidden />
        </Button>
      ) : null}
      {!side && fork && text.trim() ? (
        <Button className="ask-icon ask-fork" aria-label="深挖" title="深挖：从这条回答开一个副对话，聊完结论回到这里" onClick={() => fork({ id: stored?.id, text })}>
          <GitBranch size={13} aria-hidden />
        </Button>
      ) : null}
      {text.trim() ? <AnswerAction text={text} /> : null}
    </>
  );
}

/** 工具卡片：「已记住：……（撤销）」。 */
export function MemoryNotice({ memory }: { memory: AskMemoryNotice }): ReactElement {
  const { forget } = useContext(AskConversationContext);
  const [state, setState] = useState<"idle" | "busy" | "undone" | "failed">("idle");
  const scope = memory.scope === "book" ? "这本书" : "关于你";
  return (
    <div className="ask-memory" data-state={state}>
      <BookmarkCheck size={13} aria-hidden />
      <span className="ask-memory-text" title={`${scope}：${memory.text}`}>
        {state === "undone" ? "已撤销：" : memory.created ? "已记住：" : "早就记过："}
        {memory.text}
      </span>
      {memory.created && forget && state !== "undone" ? (
        <Button
          className="ask-memory-undo"
          disabled={state === "busy"}
          title={state === "failed" ? "没撤销成功，再试一次" : "不要记这条"}
          onClick={async () => {
            setState("busy");
            try {
              await forget(memory.id);
              setState("undone");
            } catch {
              setState("failed");
            }
          }}
        >
          <Undo2 size={11} aria-hidden />
          撤销
        </Button>
      ) : null}
    </div>
  );
}
