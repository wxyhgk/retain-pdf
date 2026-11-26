import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
// RetainPDF 的改动（groupPartByType 显式写泛型（本机 TS 只从第一组推断）；ThreadComponents 加 MessageFooter 插槽（回答底下复制、重新回答那一排的用量图标）；界面文字换中文；
// 思考用时不取整；「回到最下面」挪到右边、变小（原来居中压在正文上）；边距收紧、输入框提示缩短（提问窗窄）。
import { ComposerAddAttachment, ComposerAttachments, UserMessageAttachments, } from "./attachment.aui.js";
import { File, getFileHref } from "./file.js";
import { ThreadFollowupSuggestions } from "./follow-up-suggestions.aui.js";
import { Image as MessageImage } from "./image.js";
import { MarkdownText } from "./markdown-text.js";
import { Reasoning, ReasoningContent, ReasoningRoot, ReasoningText, ReasoningTrigger, } from "./reasoning.aui.js";
import { ToolFallback } from "./tool-fallback.aui.js";
import { ToolGroupContent, ToolGroupRoot, ToolGroupTrigger, } from "./tool-group.aui.js";
import { TooltipIconButton } from "./tooltip-icon-button.js";
import { Button } from "../shadcn/button.js";
import { Skeleton } from "../shadcn/skeleton.js";
import { cn } from "../lib/utils.js";
import { ActionBarMorePrimitive, ActionBarPrimitive, AuiIf, BranchPickerPrimitive, ComposerPrimitive, ErrorPrimitive, groupPartByType, MessagePrimitive, SuggestionPrimitive, ThreadPrimitive, useAuiState, } from "@assistant-ui/react";
import { ArrowDownIcon, ArrowUpIcon, AudioLinesIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, DownloadIcon, MicIcon, MoreHorizontalIcon, PencilIcon, PhoneIcon, RefreshCwIcon, TriangleAlertIcon, Loader2Icon, SquareIcon, PlayIcon, ThumbsDownIcon, ThumbsUpIcon, } from "lucide-react";
import { createContext, useContext, useLayoutEffect, useRef, useState, } from "react";
const DefaultToolGroup = ({ group, children, }) => {
    const [open, setOpen] = useState(false);
    return (_jsxs(ToolGroupRoot, { variant: "ghost", open: open || group.counts.requiresAction > 0, onOpenChange: setOpen, children: [_jsx(ToolGroupTrigger, { count: group.indices.length, active: group.status.type === "running" }), _jsx(ToolGroupContent, { children: children })] }));
};
const shouldShowComposerResume = (s) => !!s.thread.canResume && s.composer.type === "thread" && s.composer.isEmpty;
const reasoningDuration = (timing) => timing?.completedAt === undefined
    ? undefined
    : (timing.completedAt - timing.startedAt) / 1000;
const messageGroupBy = groupPartByType({
    reasoning: ["group-chainOfThought", "group-reasoning"],
    "tool-call": ["group-chainOfThought", "group-tool"],
    "standalone-tool-call": [],
});
const TASK_GROUP_PATH = [
    "group-chainOfThought",
    "group-task",
];
const taskAwareGroupBy = (part, context) => {
    const path = messageGroupBy(part, context);
    return part.type === "tool-call" &&
        part.messages !== undefined &&
        path.length > 0 &&
        !context?.toolUIs?.[part.toolName]?.length
        ? TASK_GROUP_PATH
        : path;
};
const EMPTY_COMPONENTS = {};
const ThreadComponentsContext = createContext(EMPTY_COMPONENTS);
// Startup exposes a loading placeholder thread; treat it as a new chat so
// the composer mounts centered. Loads after startup keep the docked layout.
const isNewChatView = (s) => s.thread.messages.length === 0 &&
    (!s.thread.isLoading || s.threads.isLoading);
// A switched thread that is still fetching its history: skeleton, not welcome.
const isHistoryLoadingView = (s) => s.thread.messages.length === 0 &&
    s.thread.isLoading &&
    !s.thread.isDisabled &&
    !s.threads.isLoading;
const ThreadHistorySkeleton = () => (_jsxs("div", { "data-slot": "aui_thread-history-skeleton", role: "status", className: "animate-in fade-in fill-mode-both flex flex-col gap-y-6 [animation-delay:150ms] [animation-duration:200ms]", children: [_jsx("span", { className: "sr-only", children: "Loading conversation" }), _jsx(Skeleton, { className: "ml-auto h-9 w-2/5 rounded-xl motion-reduce:animate-none" }), _jsxs("div", { className: "flex flex-col gap-y-2", children: [_jsx(Skeleton, { className: "h-4 w-11/12 motion-reduce:animate-none" }), _jsx(Skeleton, { className: "h-4 w-4/5 motion-reduce:animate-none" }), _jsx(Skeleton, { className: "h-4 w-3/5 motion-reduce:animate-none" })] }), _jsx(Skeleton, { className: "ml-auto h-9 w-1/3 rounded-xl motion-reduce:animate-none" }), _jsxs("div", { className: "flex flex-col gap-y-2", children: [_jsx(Skeleton, { className: "h-4 w-10/12 motion-reduce:animate-none" }), _jsx(Skeleton, { className: "h-4 w-2/3 motion-reduce:animate-none" })] })] }));
export const Thread = ({ components = EMPTY_COMPONENTS, autoFocus = true, }) => {
    const isEmpty = useAuiState(isNewChatView);
    return (_jsx(ThreadComponentsContext.Provider, { value: components, children: _jsx(ThreadRoot, { isEmpty: isEmpty, autoFocus: autoFocus }) }));
};
const ThreadRoot = ({ isEmpty, autoFocus, }) => {
    const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);
    return (_jsx(ThreadPrimitive.Root, { className: "aui-root aui-thread-root bg-background @container flex h-full flex-col", style: {
            ["--thread-max-width"]: "44rem",
            ["--composer-bg"]: "color-mix(in oklab, var(--color-muted) 30%, transparent)",
            ["--composer-radius"]: "0.75rem",
            ["--composer-padding"]: "6px",
        }, children: _jsx(ThreadPrimitive.Viewport, { turnAnchor: "top", "data-slot": "aui_thread-viewport", className: "relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth", children: _jsxs("div", { className: cn("mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-3 pt-3", isEmpty && "justify-center"), children: [_jsx(AuiIf, { condition: isNewChatView, children: _jsx(Welcome, {}) }), _jsx(AuiIf, { condition: isHistoryLoadingView, children: _jsx(ThreadHistorySkeleton, {}) }), _jsx(ThreadLoadEarlier, {}), _jsx("div", { "data-slot": "aui_message-group", className: "mb-10 flex flex-col gap-y-4 empty:hidden", children: _jsx(ThreadPrimitive.Messages, { children: () => _jsx(ThreadMessage, {}) }) }), _jsxs(ThreadPrimitive.ViewportFooter, { className: cn("aui-thread-viewport-footer bg-background flex flex-col gap-3 overflow-visible pb-3", !isEmpty &&
                            "sticky bottom-0 mt-auto rounded-t-(--composer-radius)"), children: [_jsx(ThreadScrollToBottom, {}), _jsx(ThreadFollowupSuggestions, {}), _jsx(Composer, { autoFocus: autoFocus }), _jsx(AuiIf, { condition: (s) => isNewChatView(s) && s.composer.isEmpty, children: _jsx(ThreadSuggestions, {}) })] })] }) }) }));
};
const ThreadMessage = () => {
    const { AssistantMessage: AssistantMessageComponent = AssistantMessage } = useContext(ThreadComponentsContext);
    const role = useAuiState((s) => s.message.role);
    const isEditing = useAuiState((s) => s.message.composer.isEditing);
    const isSpoken = useAuiState((s) => s.message.metadata.modality === "voice");
    if (isEditing)
        return _jsx(EditComposer, {});
    if (isSpoken)
        return _jsx(SpokenMessage, {});
    if (role === "user")
        return _jsx(UserMessage, {});
    return _jsx(AssistantMessageComponent, {});
};
const useVoiceRunPosition = () => useAuiState((s) => {
    const before = s.thread.messages[s.message.index - 1]?.metadata.modality === "voice";
    const after = s.thread.messages[s.message.index + 1]?.metadata.modality === "voice";
    if (before)
        return after ? "middle" : "end";
    return after ? "start" : "single";
});
const SpokenText = ({ text }) => (_jsx("p", { className: "aui-spoken-message-text m-0", children: text }));
const SpokenMessage = () => {
    const role = useAuiState((s) => s.message.role);
    const position = useVoiceRunPosition();
    const isSpeaking = useAuiState((s) => s.message.role === "assistant" && s.message.status?.type === "running");
    const opensExchange = position === "start" || position === "single";
    return (_jsxs(MessagePrimitive.Root, { "data-slot": "aui_spoken-message-root", "data-role": role, "data-voice-run": position, className: cn("aui-spoken-message bg-muted/40 mx-2 px-3 py-1.5 [contain-intrinsic-size:auto_48px] [content-visibility:auto]", position === "single" && "rounded-xl py-2", position === "start" && "rounded-t-xl pt-2", position === "middle" && "-mt-6", position === "end" && "-mt-6 rounded-b-xl pb-2"), children: [opensExchange && (_jsxs("div", { "data-slot": "aui_spoken-exchange-header", className: "text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs", children: [_jsx(PhoneIcon, { className: "size-3", "aria-hidden": true }), _jsx("span", { children: "\u8BED\u97F3\u5BF9\u8BDD" })] })), _jsxs("div", { "data-slot": "aui_spoken-message-content", className: "text-foreground flex items-start gap-2 text-sm leading-relaxed", children: [_jsx("span", { className: "text-muted-foreground mt-1 shrink-0", "aria-hidden": true, children: role === "user" ? (_jsx(MicIcon, { className: "size-3.5" })) : (_jsx(AudioLinesIcon, { className: "size-3.5" })) }), _jsx("span", { className: "sr-only", children: role === "user" ? "你说" : "助手说" }), _jsxs("div", { className: "min-w-0 flex-1 wrap-break-word", children: [_jsx(MessagePrimitive.Parts, { components: { Text: SpokenText } }), isSpeaking && (_jsx("span", { "data-slot": "aui_spoken-message-indicator", role: "status", className: "text-muted-foreground ms-1 animate-pulse font-sans", "aria-label": "\u52A9\u624B\u5728\u8BF4", children: "\u25CF" }))] }), _jsx(SpokenActionBar, {})] })] }));
};
const SpokenActionBar = () => {
    return (_jsx(ActionBarPrimitive.Root, { hideWhenRunning: true, autohide: "always", className: "aui-spoken-action-bar text-muted-foreground flex shrink-0 gap-1", children: _jsx(ActionBarPrimitive.Copy, { asChild: true, children: _jsxs(TooltipIconButton, { tooltip: "\u590D\u5236", className: "size-6", children: [_jsx(AuiIf, { condition: (s) => s.message.isCopied, children: _jsx(CheckIcon, { className: "animate-in zoom-in-50 fade-in duration-200 ease-out" }) }), _jsx(AuiIf, { condition: (s) => !s.message.isCopied, children: _jsx(CopyIcon, { className: "animate-in zoom-in-75 fade-in duration-150" }) })] }) }) }));
};
const FOCUSABLE_SELECTOR = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1']):not([disabled])";
const nextFocusable = (start) => {
    for (let element = start.nextElementSibling; element; element = element.nextElementSibling) {
        const target = element.matches(FOCUSABLE_SELECTOR)
            ? element
            : element.querySelector(FOCUSABLE_SELECTOR);
        if (target instanceof HTMLElement)
            return target;
    }
    return null;
};
const ThreadLoadEarlier = () => {
    const visible = useAuiState((s) => s.thread.hasEarlier || s.thread.isLoadingEarlier);
    const loading = useAuiState((s) => s.thread.isLoadingEarlier);
    const slotRef = useRef(null);
    const focusedRef = useRef(null);
    // The last page removes the button; a keyboard user on it continues from the
    // next control in tab order rather than from the document body.
    useLayoutEffect(() => {
        const focused = focusedRef.current;
        const slot = slotRef.current;
        if (visible || !focused || focused.isConnected || !slot)
            return;
        focusedRef.current = null;
        const active = document.activeElement;
        if (active && active !== document.body)
            return;
        nextFocusable(slot)?.focus();
    }, [visible]);
    return (_jsxs("div", { ref: slotRef, className: "contents", onFocus: (event) => {
            focusedRef.current = event.target;
        }, children: [_jsx("span", { role: "status", className: "sr-only", children: loading ? "在读更早的对话" : "" }), visible && (_jsx(ThreadPrimitive.LoadEarlier, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "sm", "data-slot": "aui_thread-load-earlier", className: "aui-thread-load-earlier text-muted-foreground mb-6 self-center rounded-full", children: _jsx("span", { className: cn(loading && "shimmer motion-reduce:animate-none"), children: loading ? "在读更早的对话" : "读更早的对话" }) }) }))] }));
};
const ThreadScrollToBottom = () => {
    return (_jsx(ThreadPrimitive.ScrollToBottom, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u56DE\u5230\u6700\u4E0B\u9762", variant: "outline", className: "aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-9 end-0 z-10 size-7 rounded-full p-0 disabled:invisible", children: _jsx(ArrowDownIcon, {}) }) }));
};
const ThreadWelcome = () => {
    return (_jsx("div", { className: "aui-thread-welcome-root mb-6 flex flex-col px-2", children: _jsx("p", { className: "aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-medium tracking-tight duration-200", children: "\u8FD9\u4E00\u5904\u54EA\u91CC\u770B\u4E0D\u61C2\uFF1F" }) }));
};
const ThreadSuggestions = () => {
    return (_jsx("div", { className: "aui-thread-welcome-suggestions flex w-full flex-col", children: _jsx(ThreadPrimitive.Suggestions, { children: () => _jsx(ThreadSuggestionItem, {}) }) }));
};
const ThreadSuggestionItem = () => {
    return (_jsx("div", { className: "aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200", children: _jsx(SuggestionPrimitive.Trigger, { send: true, asChild: true, children: _jsxs("button", { type: "button", className: "aui-thread-welcome-suggestion group hover:bg-foreground/[0.03] focus-visible:ring-ring/50 flex w-full items-baseline gap-2.5 rounded-md px-2 py-2 text-start text-sm transition-colors outline-none focus-visible:ring-1 motion-reduce:transition-none", children: [_jsx("span", { "aria-hidden": true, className: "text-muted-foreground/60 group-hover:text-foreground font-mono text-xs transition-colors motion-reduce:transition-none", children: ">" }), _jsxs("span", { className: "min-w-0 flex-1 truncate", children: [_jsx(SuggestionPrimitive.Title, { className: "aui-thread-welcome-suggestion-text-1 text-foreground" }), " ", _jsx(SuggestionPrimitive.Description, { className: "aui-thread-welcome-suggestion-text-2 text-muted-foreground empty:hidden" })] })] }) }) }));
};
const Composer = ({ autoFocus }) => {
    return (_jsx(ComposerPrimitive.Root, { className: "aui-composer-root relative flex w-full flex-col", children: _jsx(ComposerPrimitive.AttachmentDropzone, { asChild: true, children: _jsxs("div", { "data-slot": "aui_composer-shell", className: "border-foreground/10 focus-within:border-foreground/25 data-[dragging=true]:border-ring flex w-full cursor-text flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color] data-[dragging=true]:border-dashed data-[dragging=true]:bg-[color-mix(in_oklab,var(--color-accent)_50%,var(--color-background))]", children: [_jsx(ComposerAttachments, {}), _jsx(ComposerPrimitive.Input, { placeholder: "\u95EE\u70B9\u4EC0\u4E48\u2026", className: "aui-composer-input caret-primary placeholder:text-muted-foreground/60 max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base leading-6 outline-none", rows: 1, autoFocus: autoFocus, enterKeyHint: "send", "aria-label": "\u8F93\u5165\u95EE\u9898", title: "Enter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C" }), _jsx(ComposerAction, {})] }) }) }));
};
const ComposerAction = () => {
    const { ComposerExtra } = useContext(ThreadComponentsContext);
    // The stop control only cancels the send while no run it could stop is going.
    const isSending = useAuiState((s) => s.composer.submission !== undefined &&
        !(s.thread.isRunning && s.thread.capabilities.cancel));
    return (_jsxs("div", { className: "aui-composer-action-wrapper relative flex items-center justify-between", children: [ComposerExtra ? (_jsxs("div", { className: "aui-composer-action-start flex items-center gap-1.5", children: [_jsx(ComposerAddAttachment, {}), _jsx(ComposerExtra, {})] })) : (_jsx(ComposerAddAttachment, {})), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs(AuiIf, { condition: (s) => s.thread.capabilities.dictation, children: [_jsx(AuiIf, { condition: (s) => s.composer.dictation == null, children: _jsx(ComposerPrimitive.Dictate, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u8BED\u97F3\u8F93\u5165", side: "bottom", type: "button", variant: "ghost", size: "icon", className: "aui-composer-dictate text-muted-foreground hover:text-foreground size-7 rounded-full", "aria-label": "\u5F00\u59CB\u8BED\u97F3\u8F93\u5165", children: _jsx(MicIcon, { className: "aui-composer-dictate-icon size-4" }) }) }) }), _jsx(AuiIf, { condition: (s) => s.composer.dictation != null, children: _jsx(ComposerPrimitive.StopDictation, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u505C\u6B62\u542C\u5199", side: "bottom", type: "button", variant: "ghost", size: "icon", className: "aui-composer-stop-dictation text-destructive size-7 rounded-full", "aria-label": "\u505C\u6B62\u8BED\u97F3\u8F93\u5165", children: _jsx(SquareIcon, { className: "aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current" }) }) }) })] }), _jsx(AuiIf, { condition: (s) => (!s.composer.canCancel ||
                            (s.thread.voice !== undefined &&
                                s.composer.submission === undefined)) &&
                            !shouldShowComposerResume(s), children: _jsx(ComposerPrimitive.Send, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u53D1\u9001", side: "bottom", type: "button", variant: "default", size: "icon", className: "aui-composer-send size-7 rounded-full", "aria-label": "\u53D1\u9001", children: _jsx(ArrowUpIcon, { className: "aui-composer-send-icon size-4" }) }) }) }), _jsx(AuiIf, { condition: shouldShowComposerResume, children: _jsx(ComposerPrimitive.Resume, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u63A5\u7740\u751F\u6210", side: "bottom", type: "button", variant: "default", size: "icon", className: "aui-composer-resume size-7 rounded-full", "aria-label": "\u63A5\u7740\u751F\u6210", children: _jsx(PlayIcon, { className: "aui-composer-resume-icon size-4" }) }) }) }), _jsx(AuiIf, { condition: (s) => s.composer.canCancel &&
                            (s.thread.voice === undefined ||
                                s.composer.submission !== undefined), children: _jsx(ComposerPrimitive.Cancel, { asChild: true, children: _jsx(Button, { type: "button", variant: "default", size: "icon", className: "aui-composer-cancel size-7 rounded-full", "aria-label": isSending ? "取消发送" : "停下", children: _jsx(SquareIcon, { className: "aui-composer-cancel-icon size-3.5 fill-current" }) }) }) })] })] }));
};
const MessageError = () => {
    return (_jsx(MessagePrimitive.Error, { children: _jsxs(ErrorPrimitive.Root, { className: "aui-message-error-root group/error border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 data-[run-state=in-progress]:border-border data-[run-state=in-progress]:bg-muted/40 data-[run-state=in-progress]:text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3 text-sm data-[run-state=stale]:border-amber-500/40 data-[run-state=stale]:bg-amber-500/10 data-[run-state=stale]:text-amber-800 dark:text-red-200 dark:data-[run-state=stale]:bg-amber-500/5 dark:data-[run-state=stale]:text-amber-200", children: [_jsx(TriangleAlertIcon, { className: "hidden size-4 shrink-0 group-data-[run-state=stale]/error:block" }), _jsx(Loader2Icon, { className: "hidden size-4 shrink-0 animate-spin group-data-[run-state=in-progress]/error:block motion-reduce:animate-none" }), _jsx(ErrorPrimitive.Message, { className: "aui-message-error-message line-clamp-2 min-w-0 flex-1" }), _jsx(ActionBarPrimitive.Resume, { asChild: true, children: _jsxs(Button, { variant: "outline", size: "sm", className: "h-7 gap-1.5 border-amber-500/40 bg-transparent hover:bg-amber-500/15 disabled:hidden dark:border-amber-400/30", children: [_jsx(PlayIcon, { className: "size-3.5" }), "\u63A5\u7740\u751F\u6210"] }) }), _jsx(ActionBarPrimitive.RefreshRun, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "sm", className: "h-7 gap-1.5 disabled:hidden", children: [_jsx(RefreshCwIcon, { className: "size-3.5" }), "\u91CD\u65B0\u56DE\u7B54"] }) })] }) }));
};
const AssistantMessage = () => {
    const { Indicator, ToolFallback: ToolFallbackComponent = ToolFallback, ToolGroup, ReasoningGroup, TaskGroup: TaskGroupComponent, MessageFooter, } = useContext(ThreadComponentsContext);
    const groupBy = TaskGroupComponent ? taskAwareGroupBy : messageGroupBy;
    const ACTION_BAR_PT = "pt-1.5";
    // Keep the action bar inside the contained root's paint box, then cancel its reserved space in flow.
    const ACTION_BAR_HEIGHT = `min-h-7.5 ${ACTION_BAR_PT}`;
    return (_jsxs(MessagePrimitive.Root, { "data-slot": "aui_assistant-message-root", "data-role": "assistant", className: "fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]", children: [_jsxs("div", { "data-slot": "aui_assistant-message-content", className: "text-foreground px-2 leading-relaxed wrap-break-word", children: [_jsx(MessagePrimitive.GroupedParts, { groupBy: groupBy, children: ({ part, children }) => {
                            switch (part.type) {
                                case "group-chainOfThought":
                                    return _jsx("div", { "data-slot": "aui_chain-of-thought", children: children });
                                case "group-task":
                                    return TaskGroupComponent ? (_jsx(TaskGroupComponent, { group: part })) : null;
                                case "group-tool":
                                    if (ToolGroup) {
                                        return _jsx(ToolGroup, { group: part, children: children });
                                    }
                                    return (_jsx(DefaultToolGroup, { group: part, children: children }));
                                case "group-reasoning": {
                                    if (ReasoningGroup) {
                                        return (_jsx(ReasoningGroup, { group: part, children: children }));
                                    }
                                    const running = part.status.type === "running";
                                    return (_jsxs(ReasoningRoot, { streaming: running, children: [_jsx(ReasoningTrigger, { active: running, duration: reasoningDuration(part.timing) }), _jsx(ReasoningContent, { "aria-busy": running, children: _jsx(ReasoningText, { children: children }) })] }));
                                }
                                case "text":
                                    return _jsx(MarkdownText, {});
                                case "reasoning":
                                    return _jsx(Reasoning, { ...part });
                                case "tool-call":
                                    return part.toolUI ?? _jsx(ToolFallbackComponent, { ...part });
                                case "data":
                                    return part.dataRendererUI;
                                case "file":
                                    return (_jsx("div", { "data-slot": "aui_assistant-message-file", className: "py-1", children: _jsx(MessageFile, { ...part }) }));
                                case "image":
                                    return (_jsx("div", { "data-slot": "aui_assistant-message-image", className: "py-1", children: _jsx(MessageImage, { ...part }) }));
                                case "indicator":
                                    return Indicator ? (_jsx(Indicator, {})) : (_jsx("span", { "data-slot": "aui_assistant-message-indicator", className: "animate-pulse font-sans", "aria-label": "\u6B63\u5728\u56DE\u7B54", children: "●" }));
                                default:
                                    return null;
                            }
                        } }), _jsx(MessageError, {})] }), _jsxs("div", { "data-slot": "aui_assistant-message-footer", className: cn("ms-2 flex items-center", ACTION_BAR_HEIGHT), children: [_jsx(BranchPicker, {}), _jsx(AssistantActionBar, {}), MessageFooter ? _jsx(MessageFooter, {}) : null] })] }));
};
const AssistantActionBar = () => {
    return (_jsxs(ActionBarPrimitive.Root, { hideWhenRunning: true, autohide: "not-last", className: "aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200", children: [_jsx(ActionBarPrimitive.Copy, { asChild: true, children: _jsxs(TooltipIconButton, { tooltip: "\u590D\u5236", children: [_jsx(AuiIf, { condition: (s) => s.message.isCopied, children: _jsx(CheckIcon, { className: "animate-in zoom-in-50 fade-in duration-200 ease-out" }) }), _jsx(AuiIf, { condition: (s) => !s.message.isCopied, children: _jsx(CopyIcon, { className: "animate-in zoom-in-75 fade-in duration-150" }) })] }) }), _jsxs(AuiIf, { condition: (s) => s.thread.capabilities.feedback, children: [_jsx(ActionBarPrimitive.FeedbackPositive, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u6709\u7528", className: "data-[submitted=true]:bg-accent data-[submitted=true]:text-accent-foreground", children: _jsx(ThumbsUpIcon, {}) }) }), _jsx(ActionBarPrimitive.FeedbackNegative, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u6CA1\u7528", className: "data-[submitted=true]:bg-accent data-[submitted=true]:text-accent-foreground", children: _jsx(ThumbsDownIcon, {}) }) })] }), _jsx(ActionBarPrimitive.Reload, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u91CD\u65B0\u56DE\u7B54", children: _jsx(RefreshCwIcon, {}) }) }), _jsxs(ActionBarMorePrimitive.Root, { children: [_jsx(ActionBarMorePrimitive.Trigger, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u66F4\u591A", className: "data-[state=open]:bg-accent", children: _jsx(MoreHorizontalIcon, {}) }) }), _jsx(ActionBarMorePrimitive.Content, { side: "bottom", align: "start", sideOffset: 6, className: "aui-action-bar-more-content bg-popover text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1.5", children: _jsx(ActionBarPrimitive.ExportMarkdown, { asChild: true, children: _jsxs(ActionBarMorePrimitive.Item, { className: "aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none", children: [_jsx(DownloadIcon, { className: "size-4" }), "\u5BFC\u51FA\u6210 Markdown"] }) }) })] })] }));
};
const MessageFile = (part) => {
    const image = typeof part.mimeType === "string" &&
        typeof part.data === "string" &&
        part.mimeType.toLowerCase().startsWith("image/")
        ? getFileHref(part.data, part.mimeType, part.sourceType)
        : null;
    if (!image)
        return _jsx(File, { ...part });
    return (_jsx(MessageImage, { type: "image", image: image, status: part.status, ...(typeof part.filename === "string" && { filename: part.filename }) }));
};
const UserFilePart = (part) => (_jsx("div", { "data-slot": "aui_user-message-file", className: "py-1", children: _jsx(MessageFile, { ...part }) }));
const UserImagePart = (part) => (_jsx("div", { "data-slot": "aui_user-message-image", className: "py-1", children: _jsx(MessageImage, { ...part }) }));
const UserMessage = () => {
    return (_jsxs(MessagePrimitive.Root, { "data-slot": "aui_user-message-root", className: "fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2", "data-role": "user", children: [_jsx(UserMessageAttachments, {}), _jsxs("div", { className: "aui-user-message-content-wrapper relative col-start-2 min-w-0", children: [_jsx("div", { className: "aui-user-message-content peer bg-muted text-foreground rounded-(--composer-radius) px-4 py-2 wrap-break-word empty:hidden", children: _jsx(MessagePrimitive.Parts, { components: { File: UserFilePart, Image: UserImagePart } }) }), _jsx("div", { className: "aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full", children: _jsx(UserActionBar, {}) })] }), _jsx(BranchPicker, { "data-slot": "aui_user-branch-picker", className: "col-span-full col-start-1 -me-1 justify-end" })] }));
};
const UserActionBar = () => {
    return (_jsx(ActionBarPrimitive.Root, { hideWhenRunning: true, autohide: "not-last", className: "aui-user-action-bar-root flex flex-col items-end", children: _jsx(ActionBarPrimitive.Edit, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u6539\u8FD9\u4E2A\u95EE\u9898", className: "aui-user-action-edit", children: _jsx(PencilIcon, {}) }) }) }));
};
const EditComposer = () => {
    return (_jsx(MessagePrimitive.Root, { "data-slot": "aui_edit-composer-wrapper", className: "flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]", children: _jsxs(ComposerPrimitive.Root, { className: "aui-edit-composer-root border-foreground/10 focus-within:border-foreground/25 ms-auto flex w-full max-w-[85%] cursor-text flex-col rounded-(--composer-radius) border bg-(--composer-bg) transition-[border-color]", children: [_jsx(ComposerPrimitive.Input, { className: "aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none", autoFocus: true }), _jsxs("div", { className: "aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end", children: [_jsx(ComposerPrimitive.Cancel, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "sm", className: "h-8 px-3", children: "\u53D6\u6D88" }) }), _jsx(ComposerPrimitive.Send, { asChild: true, children: _jsx(Button, { size: "sm", className: "h-8 px-3", children: "\u91CD\u65B0\u95EE" }) })] })] }) }));
};
const BranchPicker = ({ className, ...rest }) => {
    return (_jsxs(BranchPickerPrimitive.Root, { hideWhenSingleBranch: true, className: cn("aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs", className), ...rest, children: [_jsx(BranchPickerPrimitive.Previous, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u4E0A\u4E00\u4E2A\u7248\u672C", children: _jsx(ChevronLeftIcon, {}) }) }), _jsxs("span", { className: "aui-branch-picker-state font-medium", children: [_jsx(BranchPickerPrimitive.Number, {}), " / ", _jsx(BranchPickerPrimitive.Count, {})] }), _jsx(BranchPickerPrimitive.Next, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u4E0B\u4E00\u4E2A\u7248\u672C", children: _jsx(ChevronRightIcon, {}) }) })] }));
};
