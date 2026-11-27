import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 提问窗往 assistant-ui 的 Thread 里塞的几块（AskWindow 用）：工具调用一行一个、工具分组的图标、计划、子 agent、
 * 「在想…」、回答底下的用量（图标）、空白时的几个常问。图标多、字少，细节放悬停提示。
 */
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { SimpleImageAttachmentAdapter, useAuiState } from "@assistant-ui/react";
import { Activity, ArrowDown, ArrowUp, BookOpen, Check, Clock, Coins, Cpu, DatabaseZap, Eye, Gauge, Globe, HardDriveUpload, Languages, Loader2, Pencil, PieChart, Search, Sigma, Sparkles, Terminal, Timer, Wrench, X, } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { turnFooterItems } from "../acp/parts.js";
import { AskPageText } from "./AskPageLink.js";
import { AskSendContext } from "./ask-send.js";
import { AskConversationContext } from "./conversation.js";
import { BrandIcon, brandFor } from "./BrandIcon.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/shadcn/popover.js";
import { ToolFallback } from "../ui/elements/tool-fallback.aui.js";
import { ToolGroupContent, ToolGroupRoot, ToolGroupTrigger } from "../ui/elements/tool-group.aui.js";
import { TodoList } from "../ui/elements/todo-list.js";
import { AgentStatus } from "../ui/elements/agent-status.js";
export const PermissionContext = createContext(null);
const ACP_TO_AUI_KIND = {
    allow_once: "allow-once",
    allow_always: "allow-always",
    reject_once: "reject-once",
    reject_always: "reject-always",
};
/** ACP 工具的 kind → 图标。自带 agent 的「看第 N 页的图」也是 fetch，看标题里有没有「页」。 */
export function toolIcon(kind, title) {
    switch (kind) {
        case "read": return BookOpen;
        case "search": return Search;
        case "fetch": return /页/.test(title) ? Eye : Globe;
        case "edit": return Pencil;
        case "execute": return Terminal;
        case "think": return Sparkles;
        default: return Wrench;
    }
}
function seconds(timing) {
    if (!timing || timing.completedAt === undefined)
        return "";
    const value = (timing.completedAt - timing.startedAt) / 1000;
    return `${value < 10 ? value.toFixed(1) : Math.round(value)}s`;
}
/**
 * 工具调用：一行——图标、标题（页码能点）、结果摘要、状态、用时；点开看结果全文和参数。
 * 等许可的还是用 assistant-ui 官方的 ToolFallback（它的许可界面），ACP 的选项换成它认的写法。
 */
export function ToolCard(props) {
    const artifact = (props.artifact || {});
    const timing = props.timing;
    const store = useContext(PermissionContext);
    useSyncExternalStore(store?.subscribe ?? (() => () => { }), store?.snapshot ?? (() => 0));
    const pending = store?.get(props.toolCallId);
    const title = artifact.title || props.toolName;
    if (pending) {
        const approval = {
            id: props.toolCallId,
            prompt: title,
            options: pending.request.options.map((option) => ({ id: option.optionId, kind: ACP_TO_AUI_KIND[option.kind] || option.kind, label: option.name })),
        };
        const respondToApproval = async (response) => {
            const options = pending.request.options;
            const chosen = response.optionId
                ? options.find((option) => option.optionId === response.optionId)
                : options.find((option) => (response.approved ? option.kind.startsWith("allow") : option.kind.startsWith("reject")));
            pending.resolve(chosen ? { outcome: { outcome: "selected", optionId: chosen.optionId } } : { outcome: { outcome: "cancelled" } });
        };
        return (_jsx(ToolFallback, { ...props, toolName: title, status: { type: "requires-action", reason: "interrupt" }, argsText: props.argsText && props.argsText !== "{}" ? props.argsText : "", approval: approval, respondToApproval: respondToApproval }));
    }
    const Icon = toolIcon(artifact.kind || "", title);
    const status = artifact.status || "pending";
    const output = artifact.output || "";
    const summary = output.split("\n").find((line) => line.trim()) || "";
    const where = artifact.locations?.length ? artifact.locations.join("、") : "";
    const args = props.argsText && props.argsText !== "{}" ? props.argsText : "";
    const detail = [output, where, args].filter(Boolean).join("\n\n");
    return (_jsxs("details", { className: "ask-tool", "data-status": status, children: [_jsxs("summary", { title: title, children: [_jsx(Icon, { size: 13, className: "ask-tool-icon", "aria-hidden": true }), _jsx("span", { className: "ask-tool-title", children: _jsx(AskPageText, { text: title }) }), summary && summary !== title ? _jsx("span", { className: "ask-tool-sum", children: _jsx(AskPageText, { text: summary }) }) : null, _jsx("span", { className: "ask-tool-state", "aria-label": status === "failed" ? "失败" : status === "completed" ? "完成" : "进行中", children: status === "failed" ? _jsx(X, { size: 12, "aria-hidden": true }) : status === "completed" ? _jsx(Check, { size: 12, "aria-hidden": true }) : _jsx(Loader2, { size: 12, className: "ask-spin", "aria-hidden": true }) }), seconds(timing) ? _jsx("span", { className: "ask-tool-time", children: seconds(timing) }) : null] }), detail ? _jsx("pre", { className: "ask-tool-detail", children: detail }) : null] }));
}
/** 工具分组的标题：用到的几种工具的图标、次数；正在跑的写它的标题。 */
export function AskToolGroup({ group, children }) {
    const parts = useAuiState((state) => state.message.parts);
    const [open, setOpen] = useState(false);
    const tools = group.indices.map((index) => parts[index]).filter((part) => part?.type === "tool-call");
    const running = group.status.type === "running";
    const current = running ? tools.find((part) => part.artifact?.status !== "completed" && part.artifact?.status !== "failed") || tools[tools.length - 1] : null;
    const kinds = [...new Map(tools.map((part) => {
            const title = part.artifact?.title || part.toolName || "";
            const Icon = toolIcon(part.artifact?.kind || "", title);
            return [Icon, Icon];
        })).values()].slice(0, 4);
    // 只有一个工具（子 agent、计划夹在中间时 assistant-ui 会把每个工具单独分一组）：直接画那一行，不套一层「用了 1 个工具」。
    if (tools.length <= 1)
        return _jsx(_Fragment, { children: children });
    const text = current?.artifact?.title || current?.toolName || "";
    const label = (_jsxs("span", { className: "ask-toolgroup", title: `用了 ${tools.length} 个工具`, children: [kinds.map((Icon, index) => _jsx(Icon, { size: 13, "aria-hidden": true }, index)), text ? _jsx("span", { className: "ask-toolgroup-text", children: text }) : null, tools.length > 1 ? _jsxs("span", { className: "ask-toolgroup-count", children: ["\u00D7", tools.length] }) : null] }));
    return (_jsxs(ToolGroupRoot, { variant: "ghost", open: open || group.counts.requiresAction > 0, onOpenChange: setOpen, children: [_jsx(ToolGroupTrigger, { count: tools.length, active: running, label: label }), _jsx(ToolGroupContent, { children: children })] }));
}
const PLAN_STATUS = { pending: "pending", in_progress: "active", completed: "done" };
/** 计划（ACP plan，整份替换）：assistant-ui 官方的 TodoList（每项状态图标、进度「1/3」、新项进场动画）。 */
export function PlanBlock({ data }) {
    const items = data.entries.map((entry, index) => ({ id: `${index}`, text: entry.content, status: PLAN_STATUS[entry.status] || "pending" }));
    return _jsx(TodoList, { className: "ask-plan", items: items, title: "\u8BA1\u5212", maxVisible: 6 });
}
/** 子 agent（ACP subagent_update）：assistant-ui 官方的 AgentStatus（小胶囊：进行中 / 等着 / 完成 / 失败）。 */
export function SubagentBlock({ data }) {
    const state = data.state === "idle" || data.state === "done" || data.state === "completed"
        ? "done"
        : data.state === "failed" || data.state === "error"
            ? "failed"
            : data.state === "waiting" || data.state === "paused"
                ? "waiting"
                : "working";
    return (_jsx("div", { className: "ask-subagent", children: _jsx(AgentStatus, { state: state, trailing: null, label: data.description ? `${data.title} · ${data.description}` : data.title }) }));
}
/** 第一段到之前等多久就补一句「还在等」（本机 agent 起进程、模型排队都可能慢），不说的话像卡住了。 */
export const ASK_SLOW_HINT_MS = 10_000;
/** Thread 的「正在回答」指示（还没有任何内容时它会画）：说一声在想；等久了再说一句。 */
export function Waiting() {
    const [slow, setSlow] = useState(false);
    useEffect(() => {
        const timer = window.setTimeout(() => setSlow(true), ASK_SLOW_HINT_MS);
        return () => window.clearTimeout(timer);
    }, []);
    return (_jsxs("div", { className: "ask-waiting", role: "status", children: [_jsx("span", { className: "ask-dot", "aria-hidden": true }), slow ? "还在等 agent 回应……" : "在想…"] }));
}
/** 自带 agent 只认 png / jpeg / webp / gif，单张最好 4MB 以内（Anthropic 单张约 5MB 上限，一条 WebSocket 消息最大 32MB；后端 11-26 说的）。 */
export const ASK_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";
export const ASK_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export class AskImageAttachmentAdapter extends SimpleImageAttachmentAdapter {
    accept = ASK_IMAGE_TYPES;
    async add(state) {
        if (!ASK_IMAGE_TYPES.split(",").includes(state.file.type))
            throw new Error("只能贴 PNG、JPEG、WebP、GIF 图片");
        if (state.file.size > ASK_IMAGE_MAX_BYTES)
            throw new Error("图片太大（超过 4MB），先压一下再贴");
        return super.add(state);
    }
}
const FOOTER_ICONS = {
    model: Cpu,
    input: ArrowUp,
    output: ArrowDown,
    cacheRead: DatabaseZap,
    cacheWrite: HardDriveUpload,
    context: PieChart,
    cost: Coins,
    speed: Gauge,
    firstToken: Timer,
    elapsed: Clock,
};
/** 回答底下的用量（Thread 的 MessageFooter 插槽，和复制、重新回答在同一排）：只一个图标，点开看模型、token、缓存、速度、用时。Extra 跟在后面（深挖……）。 */
export function makeMessageFooter(agentName, Extra) {
    return function MessageFooter() {
        const custom = useAuiState((state) => state.message.metadata?.custom);
        const items = custom?.turn ? turnFooterItems(custom.turn, custom.endedAt ?? null, agentName()) : [];
        const extra = Extra ? _jsx(Extra, {}) : null;
        if (!items.length)
            return extra;
        const model = items.find((item) => item.key === "model");
        const elapsed = items.find((item) => item.key === "elapsed");
        return (_jsxs(_Fragment, { children: [_jsxs(Popover, { children: [_jsx(PopoverTrigger, { className: "ask-icon ask-usage-trigger", "aria-label": "\u8FD9\u4E00\u8F6E\u7684\u7528\u91CF", title: ["用量", elapsed?.title].filter(Boolean).join(" · "), children: model ? _jsx(BrandIcon, { brand: brandFor(model.text, model.title), size: 13, title: model.title }) : _jsx(Activity, { size: 13, "aria-hidden": true }) }), _jsx(PopoverContent, { align: "start", side: "top", className: "ask-usage-panel", children: items.map((item) => {
                                const Icon = FOOTER_ICONS[item.key];
                                return (_jsxs("div", { className: "ask-usage-row", "data-key": item.key, children: [item.key === "model" ? _jsx(BrandIcon, { brand: brandFor(item.text, item.title), size: 13 }) : _jsx(Icon, { size: 13, "aria-hidden": true }), _jsx("span", { children: item.title })] }, item.key));
                            }) })] }), extra] }));
    };
}
/** 空白时：几个常问，点一下直接问。 */
const STARTERS = [
    { icon: BookOpen, text: "讲讲这段", prompt: "用中文讲讲这一段在说什么。" },
    { icon: Sigma, text: "式子怎么来的", prompt: "这里的式子是怎么推出来的？一步一步写。" },
    { icon: Languages, text: "译文准不准", prompt: "对照原文看看这段译文准不准，哪里要改。" },
];
function StarterButtons({ send }) {
    return (_jsx(_Fragment, { children: STARTERS.map(({ icon: Icon, text, prompt }) => (_jsxs(Button, { className: "ask-starter", title: prompt, onClick: () => send(prompt), children: [_jsx(Icon, { size: 13, "aria-hidden": true }), text] }, text))) }));
}
/**
 * 输入框上面、出处下面的一排常问（2026-11-27）：带着书上的一处（刚右键「问这段」、窗口开着时新选了字）、输入框空着、没在答时才有，
 * 点一下带这处直接问，问完出处清掉、这排跟着没了。对话一直延续（主对话），空白时的常问只在第一次看得到，所以挪到这里。
 */
export function PendingStarters() {
    const { pending } = useContext(AskConversationContext);
    const send = useContext(AskSendContext);
    const empty = useAuiState((state) => state.composer.isEmpty);
    const running = useAuiState((state) => state.thread.isRunning);
    if (!pending || !send || !empty || running)
        return null;
    return (_jsx("div", { className: "ask-starters ask-pending-starters", role: "group", "aria-label": "\u5E38\u95EE", children: _jsx(StarterButtons, { send: send }) }));
}
export function makeWelcome(send) {
    return function Welcome() {
        // 带着出处时常问在输入框上面（PendingStarters），这里不再重复一排。
        const { pending } = useContext(AskConversationContext);
        if (pending)
            return null;
        return (_jsx("div", { className: "ask-starters", children: _jsx(StarterButtons, { send: send }) }));
    };
}
