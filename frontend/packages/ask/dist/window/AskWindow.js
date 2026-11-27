import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 提问窗（@retainpdf/ask/window；宿主懒加载这一块）。
 *
 * - 窗口：react-rnd。三种摆法：浮动（标题栏拖动、边角调大小）、贴右边（占满右侧，左边框拖宽窄）、放大；双击标题栏放大 / 还原。
 *   Esc / ✕ 关。标题栏见 AskHeader.tsx（对话、「···」、窗口摆法）；谁来答（agent、模型、思考）在输入框那颗按钮（AskModelPicker.tsx）。
 * - 一直延续的对话（2026-11-26 主对话）：输入框上面是下一问带的出处、问题上面是问的哪儿、「深挖」、「已记住（撤销）」，见 conversation.tsx；
 *   每答完一轮交给宿主追加（use-turns.ts）。回答里选字，下一问引用那段（answer-quote.tsx）。
 * - 对话：整套照搬 assistant-ui 官方的 Thread（../ui/elements/thread.aui.tsx：复制、重新回答、改问题、版本切换、回到最下面、
 *   Markdown + KaTeX、思考、工具调用分组、许可），runtime 是 LocalRuntime + 我们的 ACP 适配（../acp/adapter.ts）。
 * - 我们往里塞的几块在 blocks.tsx：工具调用一行一个、工具分组的图标、计划 / 子 agent、「在想…」、用量（图标）、常问。
 * - 回答和工具调用里的页码能点（page-citations.ts、AskPageLink.tsx），点了交给宿主跳页。
 * 宿主给什么、能改什么：见包的 README.md。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { Maximize2 } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { AssistantRuntimeProvider, makeAssistantDataUI, useLocalRuntime } from "@assistant-ui/react";
import { toInitialMessages } from "../acp/messages.js";
import { PermissionStore, createAcpChatAdapter } from "../acp/adapter.js";
import { Thread } from "../ui/elements/thread.aui.js";
import { AskImageAttachmentAdapter, AskToolGroup, PermissionContext, PlanBlock, SubagentBlock, ToolCard, Waiting, makeMessageFooter, makeWelcome, } from "./blocks.js";
import { AskHeader } from "./AskHeader.js";
import { AskAgentsContext } from "./agent-row.js";
import { AskPageContext } from "./AskPageLink.js";
import { AskSendContext } from "./ask-send.js";
import { AskAgentSettings, AskConfigContext, currentEffort } from "./AskModelPicker.js";
import { loadDesiredConfig, saveDesiredConfig } from "./config-memory.js";
import { loadWindowMemory, pickAgent, saveWindowMemory } from "./window-memory.js";
import { useWindowLayout } from "./use-window-layout.js";
import { HostedDock } from "./dock-host.js";
import { useWideBlocks } from "./wide-blocks.js";
import { AskConversationContext, ConversationFooter, EarlierHistory, MessageAfter, QuestionContextTag } from "./conversation.js";
import { AnswerQuoteProvider, ComposerBars, UserText, useAnswerQuote } from "./answer-quote.js";
import { AttachTools, AttachToolsContext, useHostAttachments } from "./attach-tools.js";
import { useTurns } from "./use-turns.js";
const KATEX_LINK_ID = "retainpdf-katex-css";
/** KaTeX 的样式表（字体）由宿主给地址（桌面版离线也能用），打开窗口时插一个 <link>。 */
function useKatexStylesheet(href) {
    useEffect(() => {
        if (typeof document === "undefined" || !href || document.getElementById(KATEX_LINK_ID))
            return;
        const link = document.createElement("link");
        link.id = KATEX_LINK_ID;
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
    }, [href]);
}
/** 输入框那一行：宿主的「带上……」按钮，再是 agent 的设置（模型、思考强度）。 */
function ComposerExtra() {
    return (_jsxs(_Fragment, { children: [_jsx(AttachTools, {}), _jsx(AskAgentSettings, {})] }));
}
// 计划、子 agent 是 data 部件：按 assistant-ui 的办法注册渲染（挂在 runtime 里面才生效）。
const PlanDataUI = makeAssistantDataUI({ name: "plan", render: PlanBlock });
const SubagentDataUI = makeAssistantDataUI({ name: "subagent", render: SubagentBlock });
// 测试和别处照旧从这里取。
export { ASK_IMAGE_MAX_BYTES, ASK_IMAGE_TYPES, ASK_SLOW_HINT_MS } from "./blocks.js";
export default function AskWindow(props) {
    const { port, context, onContextUsed, onContextClear, onClose, title, headerActions, headerMenu, footer, onShowContext, initialMessages, earlier, onTurn, onTurnDone, onFork, onOpenSide, onForgetMemory, onRewrite, memories, readOnly, onDelete, onJumpToPage, pageCount = 0, katexStylesheetUrl, onLayout, answerAction, attachTools, attachRequest, contextOffer, dockTaken, dockInsets, dockHost } = props;
    useKatexStylesheet(katexStylesheetUrl);
    const [agents, setAgents] = useState(null);
    const [agentId, setAgentId] = useState("");
    const [loadError, setLoadError] = useState("");
    const live = useRef({ agentId, context, onContextUsed, onRewrite });
    live.current = { agentId, context, onContextUsed, onRewrite };
    // 发出去的问题问的是哪儿（按消息编号；画问题上面的小标签）。
    const [asked, setAsked] = useState(() => new Map());
    useEffect(() => {
        let cancelled = false;
        port.listAgents().then((list) => {
            if (cancelled)
                return;
            setAgents(list);
            setAgentId((current) => current || pickAgent(list, loadWindowMemory().agentId));
        }, (error) => !cancelled && setLoadError(error instanceof Error ? error.message : String(error)));
        return () => {
            cancelled = true;
        };
    }, [port]);
    const permissions = useMemo(() => new PermissionStore(), []);
    // agent 的设置项（模型、思考强度……，ACP 的 configOptions）；用户选过的值按 agent 记在本机浏览器里，新会话再设一次。
    const [config, setConfig] = useState([]);
    const chat = useMemo(() => createAcpChatAdapter({
        port,
        permissions,
        getAgentId: () => live.current.agentId,
        getContext: () => live.current.context,
        initialIds: (initialMessages || []).map((message) => message.id || ""),
        onRewrite: async (questionId) => live.current.onRewrite?.(questionId),
        onAsked: (messageId, used) => {
            if (!used)
                return;
            setAsked((current) => new Map(current).set(messageId, { page: used.page, label: used.label, data: used.meta }));
            live.current.onContextUsed?.(used);
        },
        onConfig: setConfig,
        getDesiredConfig: () => loadDesiredConfig(live.current.agentId),
    }), [port, permissions]);
    useEffect(() => () => chat.close(), [chat]);
    // 选了 agent 就提前开会话：不用先问一句，就能看到它有哪些模型、思考强度。
    useEffect(() => {
        setConfig([]);
        if (agentId)
            void chat.prepare();
    }, [chat, agentId]);
    const configState = useMemo(() => ({
        options: config,
        set: (configId, value) => {
            saveDesiredConfig(live.current.agentId, configId, value);
            setConfig((current) => current.map((option) => (option.id === configId ? { ...option, currentValue: value } : option)));
            void chat.setConfig(configId, value).catch(() => { });
        },
    }), [config, chat]);
    // 之前的问答接着显示（agent 那边是新会话：出处和之前几轮会跟着下一问带过去，见 acp-adapter）。
    const [initial] = useState(() => toInitialMessages(initialMessages || []));
    // 输入框的「+」：贴图片（截图、扫描页、图表）一起问；发出去是 ACP 的 image 块（acp-adapter 的 imageBlocks）。
    const attachments = useMemo(() => new AskImageAttachmentAdapter(), []);
    const runtime = useLocalRuntime(chat.adapter, { initialMessages: initial, adapters: { attachments } });
    // 每答完一轮交给宿主（use-turns.ts）。
    const currentAgent = useCallback(() => live.current.agentId, []);
    useTurns({ thread: runtime.thread, agentId: currentAgent, run: chat.lastRun, sessionId: chat.sessionId, onTurn, onTurnDone });
    // 回答里选字 → 下一问引用这段（answer-quote.tsx）。
    const threadRoot = useRef(null);
    const answerQuote = useAnswerQuote(threadRoot, !readOnly);
    const quoteNow = useRef(answerQuote.quote);
    quoteNow.current = answerQuote.quote;
    const answerSelection = useCallback(() => quoteNow.current, []);
    const conversationUi = useMemo(() => ({
        pending: context,
        clearPending: onContextClear,
        contexts: asked,
        showContext: onShowContext,
        earlier,
        fork: onFork,
        openSide: onOpenSide,
        forget: onForgetMemory,
        memories,
        answerAction,
        answerSelection,
        offer: contextOffer,
    }), [context, onContextClear, asked, onShowContext, earlier, onFork, onOpenSide, onForgetMemory, memories, answerAction, answerSelection, contextOffer]);
    const agentName = () => agents?.find((agent) => agent.id === live.current.agentId)?.name || "";
    // 替用户发一句：常问、互动块里的 @ToAssistant、「让它修」。
    const send = useMemo(() => (text) => runtime.thread.append({ role: "user", content: [{ type: "text", text }] }), [runtime]);
    // Thread 要的几样（引用不变，免得它整个重画）。
    const threadComponents = useMemo(() => ({
        ToolFallback: ToolCard,
        ToolGroup: AskToolGroup,
        Indicator: Waiting,
        ComposerExtra: ComposerExtra,
        Welcome: makeWelcome(send),
        MessageFooter: makeMessageFooter(agentName, ConversationFooter),
        HistoryTop: EarlierHistory,
        ComposerTop: ComposerBars,
        UserMessageTop: QuestionContextTag,
        MessageAfter,
        prepareSend: answerQuote.prepareSend,
        UserText,
        readOnly,
    }), [agents, runtime, answerQuote.prepareSend, readOnly]);
    // 宿主的「带上……」按钮、塞进来的附件（attach-tools.tsx）。
    const { attachUi, attachError } = useHostAttachments(runtime, attachTools, attachRequest);
    const pages = useMemo(() => (onJumpToPage ? { pageCount, jump: onJumpToPage } : null), [onJumpToPage, pageCount]);
    useEffect(() => {
        const onKey = (event) => {
            if (event.key !== "Escape" || event.defaultPrevented)
                return;
            // 开着弹层（选 agent、选模型、用量、更多设置）时 Esc 只关弹层，不关窗。
            if (document.querySelector("[data-radix-popper-content-wrapper]"))
                return;
            const typing = event.target?.closest?.("textarea, input, select");
            if (typing && `${typing.value || ""}`.trim())
                return;
            event.preventDefault();
            onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    // 摆法（浮动 / 贴右边 / 放大）和记住它（use-window-layout.ts）。
    const layout = useWindowLayout(onLayout, dockTaken, dockInsets);
    const { mode, rect } = layout;
    // 太宽的公式、表格：缩一点放得下就缩，再宽就横着滚、给一个「放大看」（wide-blocks.ts）。
    const wideBlocks = useWideBlocks(threadRoot);
    const chooseAgent = useCallback((id) => {
        setAgentId(id);
        saveWindowMemory({ agentId: id });
    }, []);
    // 「谁来答」里的 agent 那一排（agent-row.tsx，输入框那颗按钮的弹层里）。
    const agentsUi = useMemo(() => (agents?.length ? { agents, agentId, onAgent: chooseAgent } : null), [agents, agentId, chooseAgent]);
    // 思考强度（ask.css 读 --ask-effort-color、data-effort）：开着时输入框一圈细边、按钮上一个小点。
    // 2026-11-28 收口回黑白纸墨：聊天区正中的彩色模型水印、输入框大片发光、窗口边发光都去掉了。
    const effort = currentEffort(config);
    const tint = (effort ? { "--ask-effort-color": effort.color } : {});
    const hosted = mode === "dock" && Boolean(dockHost);
    const panel = (_jsxs("section", { className: "ask-panel", role: "dialog", "aria-label": "\u63D0\u95EE", "data-mode": mode, "data-hosted": hosted ? "true" : undefined, "data-readonly": readOnly ? "1" : undefined, "data-effort": effort?.on ? "on" : "off", style: tint, children: [_jsx(AskHeader, { title: title, actions: headerActions, menu: headerMenu, mode: mode, onMode: layout.changeMode, onDelete: onDelete, onClose: onClose }), _jsxs(AskPageContext.Provider, { value: pages, children: [loadError ? _jsxs("p", { className: "ask-error", children: ["\u5217\u4E0D\u51FA\u80FD\u7528\u7684 agent\uFF1A", loadError] }) : null, attachError ? _jsx("p", { className: "ask-error", children: attachError }) : null, _jsx(AskConversationContext.Provider, { value: conversationUi, children: _jsx(PermissionContext.Provider, { value: permissions, children: _jsx(AskSendContext.Provider, { value: send, children: _jsx(AskConfigContext.Provider, { value: configState, children: _jsx(AskAgentsContext.Provider, { value: agentsUi, children: _jsx(AttachToolsContext.Provider, { value: attachUi, children: _jsx(AnswerQuoteProvider, { value: answerQuote.ui, children: _jsxs(AssistantRuntimeProvider, { runtime: runtime, children: [_jsx(PlanDataUI, {}), _jsx(SubagentDataUI, {}), _jsxs("div", { className: "ask-thread", ref: threadRoot, children: [wideBlocks && mode !== "full" ? (_jsxs(Button, { className: "ask-wide-open", title: "\u6709\u516C\u5F0F\u6216\u8868\u683C\u592A\u5BBD\uFF0C\u8981\u6A2A\u7740\u6EDA\uFF1A\u653E\u5927\u7A97\u53E3\u770B", onClick: () => layout.changeMode("full"), children: [_jsx(Maximize2, { size: 12, "aria-hidden": true }), " \u653E\u5927\u770B"] })) : null, _jsx(Thread, { components: threadComponents, autoFocus: true })] })] }) }) }) }) }) }) }) }), footer] })] }));
    // 贴右边、宿主给了停靠栏：画进去，是页面的一栏。
    if (hosted && dockHost) {
        return createPortal(_jsx(HostedDock, { width: rect.width, onResize: layout.resizeDock, children: panel }), dockHost);
    }
    return (_jsx(Rnd, { className: `ask-window ask-window--${mode}`, position: { x: rect.x, y: rect.y }, size: { width: rect.width, height: rect.height }, minWidth: 320, minHeight: 280, bounds: "window", dragHandleClassName: "ask-head", cancel: ".ask-head button, .ask-head select, .ask-head summary, .ask-head .ui-select, .ask-head-menu-body", disableDragging: mode !== "float", enableResizing: mode === "full" ? false : mode === "dock" ? { left: true } : true, onDragStop: layout.onDragStop, onResizeStop: layout.onResizeStop, children: panel }));
}
