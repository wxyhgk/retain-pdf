import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 提问窗里跟「一直延续的对话」有关的几块（2026-11-26 主对话）：插进 Thread 的插槽，数据从 AskConversationContext 拿。
 *
 * - 输入框上面：这一问带的出处（「第 56 页 · 选中 37 字」，× 去掉；点开看引的那段）。宿主在发问那一刻读，发出去以后清掉。
 * - 问题上面：这一问问的是哪儿（小标签，点了回到那一处）。
 * - 消息最上面：「看更早的」。
 * - 回答底下：「深挖」（开副对话）；副对话的结论卡片能「看副对话」。
 * - 回答正文下面：agent 这一轮记下的记忆画成「已记住：……（撤销）」（工具卡片收起来也看得到）；压缩点画一条分隔线。
 */
import { createContext, useContext, useMemo, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { BookmarkCheck, ChevronUp, GitBranch, Loader2, MapPin, MessagesSquare, PencilLine, SquarePen, Undo2, X } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { AskQuote } from "./AskQuote.js";
export const AskConversationContext = createContext({ pending: null, contexts: new Map() });
/** 出处标签上的字：「第 56 页 · 选中 37 字」。 */
export function contextChipText(context) {
    const quote = context.quote;
    const picked = quote?.selection ? `选中 ${[...quote.selection].length} 字` : "";
    return [context.label || (context.page ? `第 ${context.page} 页` : ""), picked].filter(Boolean).join(" · ");
}
/** 输入框上面：下一问带的出处。 */
export function PendingContextBar() {
    const { pending, clearPending } = useContext(AskConversationContext);
    const [open, setOpen] = useState(false);
    if (!pending)
        return null;
    const hasQuote = Boolean(pending.quote?.selection || pending.quote?.source || pending.quote?.translated);
    return (_jsxs("div", { className: "ask-pending", "data-open": open ? "1" : "0", children: [_jsxs("div", { className: "ask-pending-chip", children: [_jsx(MapPin, { size: 12, "aria-hidden": true }), _jsx(Button, { className: "ask-pending-label", title: hasQuote ? "看引的那段" : pending.label, onClick: () => setOpen((value) => !value), disabled: !hasQuote, children: contextChipText(pending) }), clearPending ? (_jsx(Button, { className: "ask-icon ask-pending-clear", "aria-label": "\u8FD9\u4E00\u95EE\u4E0D\u5E26\u51FA\u5904", title: "\u8FD9\u4E00\u95EE\u4E0D\u5E26\u51FA\u5904", onClick: clearPending, children: _jsx(X, { size: 12, "aria-hidden": true }) })) : null] }), open && hasQuote ? _jsx(AskQuote, { quote: pending.quote }) : null] }));
}
/** 问题上面：这一问改过（「改过」，点开看原来的问和答）。 */
function RewroteTag({ rewrote }) {
    const [open, setOpen] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsxs(Button, { className: "ask-question-rewrote", title: "\u8FD9\u4E00\u95EE\u6539\u8FC7\uFF0C\u539F\u6765\u7684\u95EE\u7B54\u4F5C\u5E9F\u4E86\uFF08\u539F\u6587\u7559\u7740\uFF09", onClick: () => setOpen((value) => !value), children: [_jsx(PencilLine, { size: 11, "aria-hidden": true }), "\u6539\u8FC7"] }), open ? (_jsxs("div", { className: "ask-question-original", children: [_jsxs("p", { children: ["\u539F\u6765\u95EE\u7684\uFF1A", rewrote.question] }), rewrote.answer ? _jsxs("p", { children: ["\u539F\u6765\u7684\u56DE\u7B54\uFF1A", rewrote.answer] }) : null] })) : null] }));
}
/** 问题上面：这一问问的是哪儿；改过的再画「改过」。 */
export function QuestionContextTag() {
    const { contexts, showContext } = useContext(AskConversationContext);
    const id = useAuiState((state) => state.message.id);
    const custom = useAuiState((state) => state.message.metadata?.custom);
    const context = custom?.context || contexts.get(id);
    const rewrote = custom?.rewrote;
    if (!context && !rewrote)
        return null;
    if (!context)
        return _jsx(RewroteTag, { rewrote: rewrote });
    return (_jsxs(_Fragment, { children: [rewrote ? _jsx(RewroteTag, { rewrote: rewrote }) : null, _jsxs(Button, { className: "ask-question-where", title: showContext ? `回到问的那一处：${context.label}` : context.label, onClick: showContext ? () => showContext(context) : undefined, disabled: !showContext, children: [_jsx(MapPin, { size: 11, "aria-hidden": true }), contextChipText(context)] })] }));
}
/** 消息最上面：「看更早的」。 */
export function EarlierHistory() {
    const { earlier } = useContext(AskConversationContext);
    if (!earlier)
        return null;
    return (_jsx("div", { className: "ask-earlier", children: _jsxs(Button, { className: "ask-earlier-more", onClick: earlier.load, disabled: earlier.loading, children: [earlier.loading ? _jsx(Loader2, { size: 12, className: "ask-spin", "aria-hidden": true }) : _jsx(ChevronUp, { size: 12, "aria-hidden": true }), "\u770B\u66F4\u65E9\u7684"] }) }));
}
/** 回答正文下面：这一轮记下的记忆（工具卡片的 artifact.memory）、压缩点。 */
export function MessageAfter() {
    // 选出来的要是 store 里原样的引用（每次新数组会一直重画）：取 content，再挑。
    const content = useAuiState((state) => state.message.content);
    const id = useAuiState((state) => state.message.id);
    const { memories: later } = useContext(AskConversationContext);
    const extra = later?.get(id);
    const memories = useMemo(() => {
        const fromTools = content
            .map((part) => (part.type === "tool-call" ? part.artifact?.memory : undefined))
            .filter((memory) => Boolean(memory));
        return [...fromTools, ...(extra || []).filter((memory) => !fromTools.some((known) => known.id === memory.id))];
    }, [content, extra]);
    const compacted = useAuiState((state) => Boolean(state.message.metadata?.custom?.stored?.marks?.compactedBefore));
    if (!memories.length && !compacted)
        return null;
    return (_jsxs("div", { className: "ask-after", children: [memories.map((memory) => _jsx(MemoryNotice, { memory: memory }, memory.id)), compacted ? (_jsx("div", { className: "ask-compacted", role: "separator", title: "\u5230\u8FD9\u91CC\u4E3A\u6B62\u7684\u5BF9\u8BDD\u5DF2\u7ECF\u538B\u7F29\u6210\u6458\u8981\uFF0CAI \u4E4B\u540E\u770B\u6458\u8981\uFF1B\u539F\u6587\u8FD8\u5728\u4E0A\u9762", children: "\u4E4B\u524D\u7684\u5DF2\u538B\u7F29\u6210\u6458\u8981" })) : null] }));
}
/** 回答底下宿主加的动作：问题带着出处、宿主认这处才有。 */
function AnswerAction({ text }) {
    const { answerAction, answerSelection, contexts } = useContext(AskConversationContext);
    // 这条回答的问题：前一条（问和答一对一对挨着）。
    const question = useAuiState((state) => state.thread.messages[state.message.index - 1]);
    if (!answerAction || !question || question.role !== "user")
        return null;
    const context = question.metadata?.custom?.context || contexts.get(question.id);
    if (!context || !answerAction.available(context))
        return null;
    return (_jsx(Button, { className: "ask-icon ask-answer-action", "aria-label": answerAction.label, title: answerAction.title, onClick: () => answerAction.run(context, { text, selection: answerSelection?.() || "" }), children: _jsx(SquarePen, { size: 13, "aria-hidden": true }) }));
}
/** 回答底下：「深挖」、结论卡片的「看副对话」、宿主加的动作（「改这段译文」）。 */
export function ConversationFooter() {
    const { fork, openSide } = useContext(AskConversationContext);
    const role = useAuiState((state) => state.message.role);
    const running = useAuiState((state) => state.thread.isRunning && state.message.isLast);
    const stored = useAuiState((state) => state.message.metadata?.custom?.stored);
    const content = useAuiState((state) => state.message.content);
    const text = useMemo(() => content.map((part) => (part.type === "text" ? part.text : "")).join(""), [content]);
    if (role !== "assistant" || running)
        return null;
    const side = stored?.marks?.sideSummary;
    return (_jsxs(_Fragment, { children: [side?.sideId && openSide ? (_jsx(Button, { className: "ask-icon ask-side-open", "aria-label": "\u770B\u526F\u5BF9\u8BDD", title: `看副对话${side.title ? `「${side.title}」` : ""}的来回`, onClick: () => openSide(side.sideId), children: _jsx(MessagesSquare, { size: 13, "aria-hidden": true }) })) : null, !side && fork && text.trim() ? (_jsx(Button, { className: "ask-icon ask-fork", "aria-label": "\u6DF1\u6316", title: "\u6DF1\u6316\uFF1A\u4ECE\u8FD9\u6761\u56DE\u7B54\u5F00\u4E00\u4E2A\u526F\u5BF9\u8BDD\uFF0C\u804A\u5B8C\u7ED3\u8BBA\u56DE\u5230\u8FD9\u91CC", onClick: () => fork({ id: stored?.id, text }), children: _jsx(GitBranch, { size: 13, "aria-hidden": true }) })) : null, text.trim() ? _jsx(AnswerAction, { text: text }) : null] }));
}
/** 工具卡片：「已记住：……（撤销）」。 */
export function MemoryNotice({ memory }) {
    const { forget } = useContext(AskConversationContext);
    const [state, setState] = useState("idle");
    const scope = memory.scope === "book" ? "这本书" : "关于你";
    return (_jsxs("div", { className: "ask-memory", "data-state": state, children: [_jsx(BookmarkCheck, { size: 13, "aria-hidden": true }), _jsxs("span", { className: "ask-memory-text", title: `${scope}：${memory.text}`, children: [state === "undone" ? "已撤销：" : memory.created ? "已记住：" : "早就记过：", memory.text] }), memory.created && forget && state !== "undone" ? (_jsxs(Button, { className: "ask-memory-undo", disabled: state === "busy", title: state === "failed" ? "没撤销成功，再试一次" : "不要记这条", onClick: async () => {
                    setState("busy");
                    try {
                        await forget(memory.id);
                        setState("undone");
                    }
                    catch {
                        setState("failed");
                    }
                }, children: [_jsx(Undo2, { size: 11, "aria-hidden": true }), "\u64A4\u9500"] })) : null] }));
}
