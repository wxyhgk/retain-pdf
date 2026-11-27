/** 回答里选字引用回复（2026-11-27）：在提问窗的回答上选一段字，输入框上面出「引用回答 · 37 字」（不弹别的，× 去掉）；
 * 发出去时把这段写成 Markdown 引用（「> …」）放在问题前面，所以 agent 看得到、存进对话、改问题和重新回答都照带。
 * 问题气泡里开头那段引用画成引用框（UserText），其余照旧是纯文字。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from "react";
import { Quote, X } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { PendingStarters } from "./blocks.js";
import { ContextOfferBar, PendingContextBar } from "./conversation.js";

/** 引用最多带多少字（超出截断加「…」）。 */
export const QUOTE_LIMIT = 600;

const BLOCK_TAGS = "p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, tr, div.katex-display";

/** 选区里的字：公式换回 TeX（KaTeX 画出来的字会重复），段落之间换行，空白收拢，超长截断。 */
export function rangeText(range: Range, doc: Document = document): string {
  const box = doc.createElement("div");
  box.appendChild(range.cloneContents());
  for (const math of Array.from(box.querySelectorAll(".katex"))) {
    const tex = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
    math.replaceWith(doc.createTextNode(tex ? `$${tex}$` : math.textContent || ""));
  }
  for (const block of Array.from(box.querySelectorAll(BLOCK_TAGS))) block.append(doc.createTextNode("\n"));
  const text = (box.textContent || "")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  const chars = [...text];
  return chars.length > QUOTE_LIMIT ? `${chars.slice(0, QUOTE_LIMIT).join("")}…` : text;
}

/** 选区两头都在这个窗口的某条回答里才算；不然 ""。 */
export function answerSelectionText(root: Element | null, selection: Selection | null): string {
  if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return "";
  const inAnswer = (node: Node | null) => {
    const element = node && (node.nodeType === 1 ? (node as Element) : node.parentElement);
    const answer = element?.closest('[data-role="assistant"]');
    return Boolean(answer && root.contains(answer));
  };
  if (!inAnswer(selection.anchorNode) || !inAnswer(selection.focusNode)) return "";
  return rangeText(selection.getRangeAt(0), root.ownerDocument);
}

/** 引用 + 问题 → 发出去的字。问题是空的不加（发不出去，引用留着）。 */
export function withQuote(quote: string, text: string): string {
  if (!quote.trim() || !text.trim()) return text;
  const lines = quote.split("\n").map((line) => `> ${line}`.trimEnd());
  return `${lines.join("\n")}\n\n${text}`;
}

/** 问题开头的引用（连续的「>」行，后面空一行）拆出来；没有是 null。 */
export function splitQuote(text: string): { quote: string; rest: string } | null {
  const match = /^((?:>[^\n]*\n)*>[^\n]*)\n\n([\s\S]*)$/.exec(text);
  if (!match) return null;
  const quote = match[1].split("\n").map((line) => line.replace(/^> ?/, "")).join("\n");
  return { quote, rest: match[2] };
}

type AnswerQuoteUi = { quote: string; clear: () => void };
const AnswerQuoteContext = createContext<AnswerQuoteUi>({ quote: "", clear: () => {} });

/** 盯着窗口里的选区：选在回答上就记成下一问的引用。发出去的那段不再带第二次（选区还在也不重新冒出来）。 */
export function useAnswerQuote(root: RefObject<HTMLElement | null>, enabled = true) {
  const [quote, setQuote] = useState("");
  const used = useRef("");
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const text = answerSelectionText(root.current, document.getSelection());
        if (text && text !== used.current) setQuote(text);
      }, 250);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [root, enabled]);
  const live = useRef(quote);
  live.current = quote;
  const clear = useCallback(() => {
    used.current = live.current;
    setQuote("");
  }, []);
  /** Thread 发问之前调：带上引用，然后清掉。 */
  const prepareSend = useCallback((text: string) => {
    const next = withQuote(live.current, text);
    if (next !== text) clear();
    return next;
  }, [clear]);
  const ui = useMemo<AnswerQuoteUi>(() => ({ quote, clear }), [quote, clear]);
  return { quote, ui, prepareSend };
}

export function AnswerQuoteProvider({ value, children }: { value: AnswerQuoteUi; children: ReactElement }): ReactElement {
  return <AnswerQuoteContext.Provider value={value}>{children}</AnswerQuoteContext.Provider>;
}

/** 输入框上面：「引用回答 · 37 字」，点开看那段，× 去掉。 */
export function AnswerQuoteBar(): ReactElement | null {
  const { quote, clear } = useContext(AnswerQuoteContext);
  const [open, setOpen] = useState(false);
  if (!quote) return null;
  return (
    <div className="ask-pending ask-reply-quote" data-open={open ? "1" : "0"}>
      <div className="ask-pending-chip">
        <Quote size={12} aria-hidden />
        <Button className="ask-pending-label" title="看引的那段" onClick={() => setOpen((value) => !value)}>
          引用回答 · {[...quote].length} 字
        </Button>
        <Button className="ask-icon ask-pending-clear" aria-label="不引用这段" title="不引用这段" onClick={clear}>
          <X size={12} aria-hidden />
        </Button>
      </div>
      {open ? <blockquote className="ask-reply-quote-text">{quote}</blockquote> : null}
    </div>
  );
}

/** 输入框上面的两条：引用的回答、书上的出处。 */
export function ComposerBars(): ReactElement {
  return (
    <>
      <AnswerQuoteBar />
      <PendingContextBar />
      <ContextOfferBar />
      <PendingStarters />
    </>
  );
}

/** 问题气泡里的字：开头的引用画成引用框。 */
export function UserText({ text }: { text: string }): ReactElement {
  const parts = splitQuote(text);
  if (!parts) return <p style={{ whiteSpace: "pre-line" }}>{text}</p>;
  return (
    <>
      <blockquote className="ask-user-quote">{parts.quote}</blockquote>
      <p style={{ whiteSpace: "pre-line" }}>{parts.rest}</p>
    </>
  );
}
