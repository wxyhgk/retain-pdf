import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 回答里选字引用回复（2026-11-27）：在提问窗的回答上选一段字，输入框上面出「引用回答 · 37 字」（不弹别的，× 去掉）；
 * 发出去时把这段写成 Markdown 引用（「> …」）放在问题前面，所以 agent 看得到、存进对话、改问题和重新回答都照带。
 * 问题气泡里开头那段引用画成引用框（UserText），其余照旧是纯文字。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Quote, X } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { PendingStarters } from "./blocks.js";
import { ContextOfferBar, PendingContextBar } from "./conversation.js";
/** 引用最多带多少字（超出截断加「…」）。 */
export const QUOTE_LIMIT = 600;
const BLOCK_TAGS = "p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, tr, div.katex-display";
/** 选区里的字：公式换回 TeX（KaTeX 画出来的字会重复），段落之间换行，空白收拢，超长截断。 */
export function rangeText(range, doc = document) {
    const box = doc.createElement("div");
    box.appendChild(range.cloneContents());
    for (const math of Array.from(box.querySelectorAll(".katex"))) {
        const tex = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
        math.replaceWith(doc.createTextNode(tex ? `$${tex}$` : math.textContent || ""));
    }
    for (const block of Array.from(box.querySelectorAll(BLOCK_TAGS)))
        block.append(doc.createTextNode("\n"));
    const text = (box.textContent || "")
        .split("\n")
        .map((line) => line.replace(/[ \t ]+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
    const chars = [...text];
    return chars.length > QUOTE_LIMIT ? `${chars.slice(0, QUOTE_LIMIT).join("")}…` : text;
}
/** 选区两头都在这个窗口的某条回答里才算；不然 ""。 */
export function answerSelectionText(root, selection) {
    if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0)
        return "";
    const inAnswer = (node) => {
        const element = node && (node.nodeType === 1 ? node : node.parentElement);
        const answer = element?.closest('[data-role="assistant"]');
        return Boolean(answer && root.contains(answer));
    };
    if (!inAnswer(selection.anchorNode) || !inAnswer(selection.focusNode))
        return "";
    return rangeText(selection.getRangeAt(0), root.ownerDocument);
}
/** 引用 + 问题 → 发出去的字。问题是空的不加（发不出去，引用留着）。 */
export function withQuote(quote, text) {
    if (!quote.trim() || !text.trim())
        return text;
    const lines = quote.split("\n").map((line) => `> ${line}`.trimEnd());
    return `${lines.join("\n")}\n\n${text}`;
}
/** 问题开头的引用（连续的「>」行，后面空一行）拆出来；没有是 null。 */
export function splitQuote(text) {
    const match = /^((?:>[^\n]*\n)*>[^\n]*)\n\n([\s\S]*)$/.exec(text);
    if (!match)
        return null;
    const quote = match[1].split("\n").map((line) => line.replace(/^> ?/, "")).join("\n");
    return { quote, rest: match[2] };
}
const AnswerQuoteContext = createContext({ quote: "", clear: () => { } });
/** 盯着窗口里的选区：选在回答上就记成下一问的引用。发出去的那段不再带第二次（选区还在也不重新冒出来）。 */
export function useAnswerQuote(root, enabled = true) {
    const [quote, setQuote] = useState("");
    const used = useRef("");
    useEffect(() => {
        if (!enabled || typeof document === "undefined")
            return undefined;
        let timer = null;
        const onChange = () => {
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(() => {
                const text = answerSelectionText(root.current, document.getSelection());
                if (text && text !== used.current)
                    setQuote(text);
            }, 250);
        };
        document.addEventListener("selectionchange", onChange);
        return () => {
            if (timer)
                clearTimeout(timer);
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
    const prepareSend = useCallback((text) => {
        const next = withQuote(live.current, text);
        if (next !== text)
            clear();
        return next;
    }, [clear]);
    const ui = useMemo(() => ({ quote, clear }), [quote, clear]);
    return { quote, ui, prepareSend };
}
export function AnswerQuoteProvider({ value, children }) {
    return _jsx(AnswerQuoteContext.Provider, { value: value, children: children });
}
/** 输入框上面：「引用回答 · 37 字」，点开看那段，× 去掉。 */
export function AnswerQuoteBar() {
    const { quote, clear } = useContext(AnswerQuoteContext);
    const [open, setOpen] = useState(false);
    if (!quote)
        return null;
    return (_jsxs("div", { className: "ask-pending ask-reply-quote", "data-open": open ? "1" : "0", children: [_jsxs("div", { className: "ask-pending-chip", children: [_jsx(Quote, { size: 12, "aria-hidden": true }), _jsxs(Button, { className: "ask-pending-label", title: "\u770B\u5F15\u7684\u90A3\u6BB5", onClick: () => setOpen((value) => !value), children: ["\u5F15\u7528\u56DE\u7B54 \u00B7 ", [...quote].length, " \u5B57"] }), _jsx(Button, { className: "ask-icon ask-pending-clear", "aria-label": "\u4E0D\u5F15\u7528\u8FD9\u6BB5", title: "\u4E0D\u5F15\u7528\u8FD9\u6BB5", onClick: clear, children: _jsx(X, { size: 12, "aria-hidden": true }) })] }), open ? _jsx("blockquote", { className: "ask-reply-quote-text", children: quote }) : null] }));
}
/** 输入框上面的两条：引用的回答、书上的出处。 */
export function ComposerBars() {
    return (_jsxs(_Fragment, { children: [_jsx(AnswerQuoteBar, {}), _jsx(PendingContextBar, {}), _jsx(ContextOfferBar, {}), _jsx(PendingStarters, {})] }));
}
/** 问题气泡里的字：开头的引用画成引用框。 */
export function UserText({ text }) {
    const parts = splitQuote(text);
    if (!parts)
        return _jsx("p", { style: { whiteSpace: "pre-line" }, children: text });
    return (_jsxs(_Fragment, { children: [_jsx("blockquote", { className: "ask-user-quote", children: parts.quote }), _jsx("p", { style: { whiteSpace: "pre-line" }, children: parts.rest })] }));
}
