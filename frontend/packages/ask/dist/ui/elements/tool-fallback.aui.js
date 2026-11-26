import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
// RetainPDF 的改动（提示文字换中文）。
import { forwardRef, memo, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, } from "react";
import { AlertCircleIcon, CheckIcon, ChevronDownIcon, CircleMinusIcon, LoaderIcon, XCircleIcon, } from "lucide-react";
import { toolApprovalAcceptsText, useAuiState, useScrollLock, useToolCallElapsed, } from "@assistant-ui/react";
import { cn } from "../lib/utils.js";
import { CollapsibleRoot as Collapsible, CollapsibleContent, CollapsibleTrigger, } from "./collapsible-root.js";
import { Button } from "../shadcn/button.js";
import { Textarea } from "../shadcn/textarea.js";
const ANIMATION_DURATION = 200;
const pressable = "active:scale-[0.98]";
function ToolFallbackRoot({ className, open: controlledOpen, onOpenChange: controlledOnOpenChange, defaultOpen = false, children, ...props }) {
    const collapsibleRef = useRef(null);
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
    const handleOpenChange = useCallback((open) => {
        lockScroll();
        if (!isControlled) {
            setUncontrolledOpen(open);
        }
        controlledOnOpenChange?.(open);
    }, [lockScroll, isControlled, controlledOnOpenChange]);
    return (_jsx(Collapsible, { ref: collapsibleRef, "data-slot": "tool-fallback-root", open: isOpen, onOpenChange: handleOpenChange, className: cn("aui-tool-fallback-root group/tool-fallback-root w-full", className), style: {
            "--animation-duration": `${ANIMATION_DURATION}ms`,
        }, ...props, children: children }));
}
const statusIconMap = {
    running: LoaderIcon,
    complete: CheckIcon,
    incomplete: XCircleIcon,
    "requires-action": AlertCircleIcon,
};
const formatToolDuration = (ms) => {
    if (ms < 1000)
        return "<1s";
    const seconds = ms / 1000;
    if (seconds < 10)
        return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
    if (seconds < 60)
        return `${Math.floor(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};
function ToolFallbackDuration({ className, ...props }) {
    const elapsedMs = useToolCallElapsed();
    if (elapsedMs === undefined)
        return null;
    return (_jsx("span", { "data-slot": "tool-fallback-duration", className: cn("aui-tool-fallback-duration text-muted-foreground text-xs tabular-nums", className), ...props, children: formatToolDuration(elapsedMs) }));
}
function ToolFallbackTrigger({ toolName, status, isError, responseDeliveryStatus, className, ...props }) {
    const reportedType = status?.type ?? "complete";
    const statusType = reportedType === "complete" && isError ? "incomplete" : reportedType;
    const isRunning = statusType === "running";
    const isCancelled = status?.type === "incomplete" && status.reason === "cancelled";
    const Icon = statusIconMap[statusType];
    const label = responseDeliveryStatus === "queued"
        ? "回复排着，还没发出"
        : statusType === "running"
            ? "正在用工具"
            : statusType === "requires-action"
                ? "等你决定"
                : statusType === "incomplete"
                    ? `${isCancelled ? "取消了的" : "失败的"}工具`
                    : "用了工具";
    return (_jsxs(CollapsibleTrigger, { "data-slot": "tool-fallback-trigger", className: cn("aui-tool-fallback-trigger group/trigger text-muted-foreground hover:text-foreground flex w-fit max-w-full origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]", className), ...props, children: [_jsx(Icon, { "data-slot": "tool-fallback-trigger-icon", className: cn("aui-tool-fallback-trigger-icon size-4 shrink-0", isCancelled && "text-muted-foreground", isRunning && "animate-spin [animation-duration:0.6s]") }), _jsxs("span", { "data-slot": "tool-fallback-trigger-label", className: cn("aui-tool-fallback-trigger-label-wrapper inline-block min-w-0 text-start leading-none wrap-anywhere", isCancelled && "text-muted-foreground line-through", isRunning && "shimmer motion-reduce:animate-none"), children: [label, ": ", _jsx("b", { children: toolName })] }), _jsx(ToolFallbackDuration, {}), _jsx(ChevronDownIcon, { "data-slot": "tool-fallback-trigger-chevron", className: cn("aui-tool-fallback-trigger-chevron size-4 shrink-0", "transition-transform duration-(--animation-duration) ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none", "-rotate-90", "group-data-open/trigger:rotate-0", "group-data-panel-open/trigger:rotate-0") })] }));
}
function ToolFallbackContent({ className, children, ...props }) {
    return (_jsx(CollapsibleContent, { "data-slot": "tool-fallback-content", className: cn("aui-tool-fallback-content relative overflow-hidden text-sm outline-none", "group/collapsible-content ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none", "data-closed:animate-collapsible-up", "data-open:animate-collapsible-down", "data-closed:fill-mode-forwards", "data-closed:pointer-events-none", "[--tw-duration:var(--animation-duration)]", className), ...props, children: _jsx("div", { className: cn("flex flex-col gap-2 ps-6 pt-1 pb-2 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none", "group-data-open/collapsible-content:animate-in group-data-open/collapsible-content:fade-in-0 group-data-open/collapsible-content:blur-in-[2px] group-data-open/collapsible-content:slide-in-from-top-1", "group-data-closed/collapsible-content:animate-out group-data-closed/collapsible-content:fade-out-0 group-data-closed/collapsible-content:blur-out-[2px] group-data-closed/collapsible-content:slide-out-to-top-1", "group-data-closed/collapsible-content:animation-duration-(--animation-duration) group-data-open/collapsible-content:animation-duration-(--animation-duration)"), children: children }) }));
}
function ToolFallbackArgs({ argsText, className, ...props }) {
    if (!argsText)
        return null;
    return (_jsx("div", { "data-slot": "tool-fallback-args", className: cn("aui-tool-fallback-args", className), ...props, children: _jsx("pre", { className: "aui-tool-fallback-args-value bg-muted/50 text-foreground/90 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap", children: argsText }) }));
}
const formatUnknownValue = (value, space) => {
    if (typeof value === "string")
        return value;
    try {
        if (value instanceof Error)
            return String(value);
        const json = JSON.stringify(value, null, space);
        if (json !== undefined)
            return json;
    }
    catch { }
    try {
        return String(value);
    }
    catch {
        return "[Unserializable value]";
    }
};
function ToolFallbackResult({ result, className, ...props }) {
    if (result === undefined)
        return null;
    return (_jsxs("div", { "data-slot": "tool-fallback-result", className: cn("aui-tool-fallback-result", className), ...props, children: [_jsx("p", { className: "aui-tool-fallback-result-header text-muted-foreground text-xs font-medium", children: "\u7ED3\u679C\uFF1A" }), _jsx("pre", { className: "aui-tool-fallback-result-content bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs break-words whitespace-pre-wrap", children: formatUnknownValue(result, 2) })] }));
}
function ToolFallbackError({ status, className, ...props }) {
    if (status?.type !== "incomplete")
        return null;
    const error = status.error;
    const errorText = error === undefined || error === null ? null : formatUnknownValue(error);
    if (!errorText)
        return null;
    const isCancelled = status.reason === "cancelled";
    const headerText = isCancelled ? "取消原因：" : "出错：";
    return (_jsxs("div", { "data-slot": "tool-fallback-error", className: cn("aui-tool-fallback-error", className), ...props, children: [_jsx("p", { className: "aui-tool-fallback-error-header text-muted-foreground font-semibold", children: headerText }), _jsx("p", { className: "aui-tool-fallback-error-reason text-muted-foreground break-words whitespace-pre-line", children: errorText })] }));
}
const APPROVED_RESULT = "用户同意了";
const DENIED_RESULT = "用户没同意";
const APPROVAL_OPTION_DEFAULT_LABELS = {
    "allow-once": "允许",
    "allow-always": "总是允许",
    "reject-once": "不允许",
    "reject-always": "总是不允许",
};
const isKnownKind = (kind) => Object.hasOwn(APPROVAL_OPTION_DEFAULT_LABELS, kind);
const isAllowKind = (kind) => kind === "allow-once" || kind === "allow-always";
const approvalOptionLabel = (option) => option.label ??
    (isKnownKind(option.kind)
        ? APPROVAL_OPTION_DEFAULT_LABELS[option.kind]
        : undefined) ??
    option.id;
/**
 * A request that declares how it wants to be presented is asking a question,
 * not gating an action, so a refusal is not one of the answers it accepts
 * unless the request declares itself dismissible.
 */
const isQuestion = (approval) => approval?.display === "select" ||
    approval?.display === "text" ||
    approval?.display === "questions";
const questionAcceptsText = (question) => !question.options?.length || question.allowFreeform === true;
const answerLabels = (question, answer) => [
    ...(answer?.optionIds ?? []).map((id) => question.options?.find((option) => option.id === id)?.label ?? id),
    ...(answer?.text?.trim() ? [answer.text] : []),
];
const isSettled = (approval) => approval != null &&
    (approval.approved !== undefined || approval.resolution !== undefined);
/**
 * A settled request reads as a past-tense record of what happened to it, so
 * scrolling back never shows a live control for a decision already made.
 */
const approvalReceipt = (approval) => {
    if (approval.resolution !== undefined)
        return {
            outcome: "closed",
            label: approval.resolution === "cancelled"
                ? "没决定就取消了"
                : "没决定就过期了",
        };
    const chosen = approval.optionId === undefined
        ? undefined
        : approval.options?.find((option) => option.id === approval.optionId);
    const option = chosen !== undefined
        ? approvalOptionLabel(chosen)
        : approval.optionId === undefined
            ? undefined
            : approval.optionId;
    const answered = isQuestion(approval) || (chosen !== undefined && !isKnownKind(chosen.kind));
    const automatic = approval.isAutomatic ? "自动" : "";
    if (approval.approved)
        return {
            outcome: "allowed",
            label: `${automatic}${answered ? "回答了" : "允许了"}`,
            option,
        };
    return {
        outcome: "refused",
        label: `${automatic}${answered ? "跳过了" : "没允许"}`,
        option,
    };
};
const receiptIcons = {
    allowed: CheckIcon,
    refused: XCircleIcon,
    closed: CircleMinusIcon,
};
function ToolFallbackApprovalReceipt({ approval, className, receiptRef, ...props }) {
    const receipt = approvalReceipt(approval);
    const Icon = receiptIcons[receipt.outcome];
    const notes = [
        ...new Set([approval.text, approval.reason].filter((value) => typeof value === "string" && value !== "")),
    ];
    return (_jsxs("div", { ref: receiptRef, "data-slot": "tool-fallback-approval-receipt", "data-outcome": receipt.outcome, tabIndex: -1, className: cn("aui-tool-fallback-approval-receipt flex flex-col gap-1.5 pt-1", className), ...props, children: [approval.prompt ? (_jsx("p", { className: "aui-tool-fallback-approval-prompt text-muted-foreground whitespace-pre-line", children: approval.prompt })) : null, _jsxs("p", { className: "aui-tool-fallback-approval-receipt-label flex items-center gap-1.5", children: [_jsx(Icon, { "aria-hidden": true, className: "text-muted-foreground size-3.5 shrink-0" }), _jsx("span", { className: "font-medium", children: receipt.label }), receipt.option !== undefined ? (_jsxs("span", { className: "text-muted-foreground", children: ["\u00B7 ", receipt.option] })) : null] }), approval.answers &&
                approval.questions?.map((question) => {
                    const labels = answerLabels(question, approval.answers && Object.hasOwn(approval.answers, question.id)
                        ? approval.answers[question.id]
                        : undefined);
                    if (labels.length === 0)
                        return null;
                    return (_jsxs("p", { className: "aui-tool-fallback-approval-receipt-answer whitespace-pre-line", children: [_jsx("span", { className: "text-muted-foreground", children: question.header ?? question.prompt }), " ", "\u00B7 ", labels.join(", ")] }, question.id));
                }), notes.map((text) => (_jsx("p", { className: "aui-tool-fallback-approval-receipt-note text-muted-foreground whitespace-pre-line", children: text }, text)))] }));
}
function ToolFallbackApprovalQuestions({ questions, dismissible, locked, onSend, onDismiss, }) {
    const [selected, setSelected] = useState(() => new Map());
    const [typed, setTyped] = useState(() => new Map());
    const toggle = (question, optionId) => setSelected((current) => {
        const chosen = current.get(question.id) ?? [];
        const next = chosen.includes(optionId)
            ? chosen.filter((id) => id !== optionId)
            : question.multiple
                ? [...chosen, optionId]
                : [optionId];
        return new Map(current).set(question.id, next);
    });
    const answerOf = (question) => {
        const optionIds = selected.get(question.id) ?? [];
        const draft = typed.get(question.id);
        const text = draft?.trim() ? draft : undefined;
        return {
            ...(optionIds.length > 0 && { optionIds }),
            ...(text !== undefined && { text }),
        };
    };
    const complete = questions.length > 0 &&
        questions.every((question) => {
            const answer = answerOf(question);
            return answer.optionIds !== undefined || answer.text !== undefined;
        });
    const send = () => {
        if (locked || !complete)
            return;
        onSend(Object.fromEntries(questions.map((question) => [question.id, answerOf(question)])));
    };
    return (_jsxs(_Fragment, { children: [questions.map((question) => {
                const chosen = selected.get(question.id) ?? [];
                const described = question.options?.some((option) => option.description) ?? false;
                return (_jsxs("div", { role: "group", "aria-label": question.prompt, "data-slot": "tool-fallback-approval-question", className: "aui-tool-fallback-approval-question flex flex-col gap-2", children: [_jsxs("p", { className: "aui-tool-fallback-approval-question-prompt text-foreground whitespace-pre-line", children: [question.header ? (_jsx("span", { className: "text-muted-foreground me-1.5 text-xs font-medium uppercase", children: question.header })) : null, question.prompt] }), question.options && question.options.length > 0 ? (_jsx("div", { className: cn("flex gap-2", described
                                ? "flex-col items-stretch"
                                : "flex-wrap items-center"), children: question.options.map((option) => {
                                const pressed = chosen.includes(option.id);
                                return (_jsxs(Button, { size: "sm", variant: pressed ? "default" : "outline", className: cn(pressable, described &&
                                        "h-auto flex-col items-start gap-0.5 py-2 text-start whitespace-normal"), "aria-pressed": pressed, onClick: () => toggle(question, option.id), disabled: locked, children: [_jsx("span", { children: option.label }), option.description ? (_jsx("span", { className: "text-xs font-normal opacity-80", children: option.description })) : null] }, option.id));
                            }) })) : null, questionAcceptsText(question) ? (_jsx(Textarea, { value: typed.get(question.id) ?? "", onChange: (event) => setTyped((current) => new Map(current).set(question.id, event.target.value)), disabled: locked, "aria-label": question.prompt, placeholder: question.options?.length
                                ? "或者自己写"
                                : "写下你的回答" })) : null] }, question.id));
            }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { size: "sm", className: pressable, onClick: send, disabled: locked || !complete, children: "\u53D1\u9001" }), dismissible ? (_jsx(Button, { size: "sm", variant: "outline", className: pressable, onClick: onDismiss, disabled: locked, children: "\u8DF3\u8FC7" })) : null] })] }));
}
const offersInterruptAction = (status, approval, interrupt) => status?.type !== "requires-action" ||
    status.reason !== "interrupt" ||
    approval != null ||
    interrupt != null;
const ToolFallbackApproval = forwardRef(function ToolFallbackApproval(props, ref) {
    const carryFocusRef = useRef(false);
    return (_jsx(ToolFallbackApprovalImpl, { carryFocusRef: carryFocusRef, forwardedRef: ref, ...props }, props.approval?.id));
});
function ToolFallbackApprovalImpl({ className, forwardedRef, carryFocusRef, addResult, resume, interrupt, approval, respondToApproval, status, ...props }) {
    const [submitted, setSubmitted] = useState(false);
    const voiceActive = useAuiState((s) => s.thread.voice !== undefined);
    const canAnswer = useAuiState((s) => s.thread.capabilities.answerToolCall);
    const locked = submitted || voiceActive;
    const [confirmingId, setConfirmingId] = useState(null);
    const [answer, setAnswer] = useState("");
    const [error, setError] = useState(null);
    const isRequiresAction = status?.type === "requires-action";
    const [prevRequiresAction, setPrevRequiresAction] = useState(isRequiresAction);
    const [attempt, setAttempt] = useState(0);
    const attemptRef = useRef(attempt);
    useLayoutEffect(() => {
        attemptRef.current = attempt;
    }, [attempt]);
    if (isRequiresAction !== prevRequiresAction) {
        setPrevRequiresAction(isRequiresAction);
        if (isRequiresAction) {
            setSubmitted(false);
            setConfirmingId(null);
            setAnswer("");
            setError(null);
            setAttempt(attempt + 1);
        }
    }
    const pendingGroupRef = useRef(null);
    const receiptRef = useRef(null);
    const focusReceiptRef = useRef(null);
    useLayoutEffect(() => {
        if (carryFocusRef.current) {
            carryFocusRef.current = false;
            pendingGroupRef.current?.focus({ preventScroll: true });
        }
        return () => {
            const element = pendingGroupRef.current ?? receiptRef.current;
            carryFocusRef.current =
                element?.contains(element.ownerDocument.activeElement) ?? false;
        };
    }, [carryFocusRef]);
    useImperativeHandle(forwardedRef, () => pendingGroupRef.current ?? receiptRef.current);
    const setReceipt = useCallback((element) => {
        receiptRef.current = element;
        if (!element)
            return;
        const shouldFocus = focusReceiptRef.current === approval?.id;
        focusReceiptRef.current = null;
        if (shouldFocus)
            element.focus({ preventScroll: true });
    }, [approval?.id]);
    const setPendingGroup = useCallback((element) => {
        const group = pendingGroupRef.current;
        focusReceiptRef.current =
            !element && group?.contains(group.ownerDocument.activeElement)
                ? approval?.id
                : null;
        pendingGroupRef.current = element;
    }, [approval?.id]);
    const hidePendingApproval = approval != null &&
        !isSettled(approval) &&
        status !== undefined &&
        status.type !== "requires-action" &&
        !(submitted && status.type === "running");
    useLayoutEffect(() => {
        if (hidePendingApproval)
            focusReceiptRef.current = null;
    }, [hidePendingApproval]);
    const focusPendingGroup = () => {
        const group = pendingGroupRef.current;
        if (group?.contains(group.ownerDocument.activeElement)) {
            group.focus({ preventScroll: true });
        }
    };
    if (approval != null && isSettled(approval))
        return (_jsx(ToolFallbackApprovalReceipt, { approval: approval, receiptRef: setReceipt, className: className, ...props }));
    if (hidePendingApproval ||
        !offersInterruptAction(status, approval, interrupt))
        return null;
    const promptText = approval?.prompt ? (_jsx("p", { className: "aui-tool-fallback-approval-prompt text-foreground whitespace-pre-line", children: approval.prompt })) : null;
    if (!canAnswer)
        return (promptText && (_jsx("div", { "data-slot": "tool-fallback-approval", tabIndex: -1, className: cn("aui-tool-fallback-approval flex flex-col gap-2 pt-1", className), ...props, ref: setPendingGroup, children: promptText })));
    // A declared option list is a host constraint: the kit never adds an
    // approval path beyond it, and preserves a refusal path only where the
    // request is an action the user may refuse.
    const declaredOptions = respondToApproval ? approval?.options : undefined;
    const acceptsText = approval != null &&
        respondToApproval != null &&
        toolApprovalAcceptsText(approval);
    // A refused response leaves the request open, so the controls come back
    // rather than staying spent on a decision the runtime never recorded.
    const submit = (send) => {
        focusPendingGroup();
        setSubmitted(true);
        setConfirmingId(null);
        setError(null);
        void (async () => {
            try {
                await send();
            }
            catch (sendError) {
                if (attemptRef.current !== attempt)
                    return;
                setSubmitted(false);
                setError(sendError instanceof Error ? sendError.message : String(sendError));
            }
        })();
    };
    const respond = (approved) => {
        if (locked)
            return;
        if (approval != null &&
            approval.approved === undefined &&
            respondToApproval) {
            submit(() => respondToApproval({ approved, ...typedNote() }));
        }
        else if (interrupt) {
            submit(() => resume?.({ approved }));
        }
        else if (status?.type === "requires-action" &&
            status.reason === "interrupt") {
            return;
        }
        else {
            submit(() => addResult?.(approved ? APPROVED_RESULT : DENIED_RESULT));
        }
    };
    const respondWithOption = (option) => {
        if (locked)
            return;
        // A custom kind has no decision class for the runtime to derive, and
        // responding without one throws; picking a declared option is an answer,
        // so it resolves as approved.
        submit(() => respondToApproval?.(isKnownKind(option.kind)
            ? { optionId: option.id, ...typedNote() }
            : { optionId: option.id, approved: true, ...typedNote() }));
    };
    const typedNote = () => (answer.trim() ? { text: answer } : {});
    // The kit does not validate an answer the request never constrained: a host
    // that cannot record an empty one rejects it, which reopens the controls.
    const submitAnswer = () => {
        if (locked)
            return;
        submit(() => respondToApproval?.({ text: answer }));
    };
    // A dismissal is no answer at all, so a typed draft does not travel with it.
    const dismiss = () => {
        if (locked)
            return;
        submit(() => respondToApproval?.({ approved: false }));
    };
    const handleOption = (option) => {
        if (option.confirm) {
            focusPendingGroup();
            setConfirmingId(option.id);
        }
        else {
            respondWithOption(option);
        }
    };
    const confirming = confirmingId != null
        ? declaredOptions?.find((o) => o.id === confirmingId)
        : undefined;
    const question = isQuestion(approval);
    const dismissible = question && respondToApproval != null && approval?.dismissible === true;
    const dismissButton = dismissible ? (_jsx(Button, { size: "sm", variant: "outline", className: pressable, onClick: dismiss, disabled: locked, children: "\u8DF3\u8FC7" })) : null;
    const errorText = error ? (_jsx("p", { role: "alert", className: "aui-tool-fallback-approval-error text-destructive text-xs whitespace-pre-line", children: error })) : null;
    const answerField = acceptsText ? (_jsxs("div", { className: "aui-tool-fallback-approval-answer flex flex-col items-start gap-2", children: [_jsx(Textarea, { value: answer, onChange: (event) => setAnswer(event.target.value), disabled: locked, "aria-label": question ? (approval?.prompt ?? "回答") : "备注", placeholder: question ? "写下你的回答" : "给这个决定加一句备注" }), question && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { size: "sm", className: pressable, onClick: submitAnswer, disabled: locked, children: "\u53D1\u9001" }), dismissButton] }))] })) : null;
    if (approval?.display === "questions" && respondToApproval) {
        return (_jsxs("div", { "data-slot": "tool-fallback-approval", tabIndex: -1, className: cn("aui-tool-fallback-approval flex flex-col gap-3 pt-1", className), ...props, ref: setPendingGroup, children: [promptText, _jsx(ToolFallbackApprovalQuestions, { questions: approval.questions ?? [], dismissible: approval.dismissible === true, locked: locked, onSend: (answers) => submit(() => respondToApproval({ answers })), onDismiss: dismiss }), errorText] }));
    }
    if (confirming) {
        const confirmMeta = typeof confirming.confirm === "object" ? confirming.confirm : undefined;
        const confirmDescription = confirmMeta?.description ?? confirming.description;
        return (_jsxs("div", { "data-slot": "tool-fallback-approval-confirm", tabIndex: -1, className: cn("aui-tool-fallback-approval-confirm flex flex-col gap-2 pt-1", className), ...props, ref: setPendingGroup, children: [_jsx("p", { className: "aui-tool-fallback-approval-confirm-title font-semibold", children: confirmMeta?.title ?? `${approvalOptionLabel(confirming)}?` }), confirmDescription && (_jsx("p", { className: "aui-tool-fallback-approval-confirm-description text-muted-foreground whitespace-pre-line", children: confirmDescription })), confirming.grants && confirming.grants.length > 0 && (_jsx("ul", { className: "aui-tool-fallback-approval-confirm-grants flex flex-col gap-1", children: confirming.grants.map((grant) => (_jsx("li", { children: _jsx("code", { className: "aui-tool-fallback-approval-confirm-grant bg-muted rounded px-1.5 py-0.5 text-xs", children: grant }) }, grant))) })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { size: "sm", className: pressable, onClick: () => respondWithOption(confirming), disabled: locked, children: "\u786E\u5B9A" }), _jsx(Button, { size: "sm", variant: "outline", className: pressable, onClick: () => {
                                focusPendingGroup();
                                setConfirmingId(null);
                            }, disabled: locked, children: "\u8FD4\u56DE" })] })] }));
    }
    if (declaredOptions && declaredOptions.length > 0) {
        const allowOptions = declaredOptions.filter((o) => isAllowKind(o.kind));
        const customOptions = declaredOptions.filter((o) => !isKnownKind(o.kind));
        const rejectOptions = declaredOptions.filter((o) => isKnownKind(o.kind) && !isAllowKind(o.kind));
        return (_jsxs("div", { "data-slot": "tool-fallback-approval", tabIndex: -1, className: cn("aui-tool-fallback-approval flex flex-col gap-2 pt-1", className), ...props, ref: setPendingGroup, children: [promptText, _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [[...allowOptions, ...customOptions, ...rejectOptions].map((option) => (_jsx(Button, { size: "sm", variant: option === allowOptions[0] ? "default" : "outline", className: pressable, onClick: () => handleOption(option), disabled: locked, children: approvalOptionLabel(option) }, option.id))), rejectOptions.length === 0 && !question && (_jsx(Button, { size: "sm", variant: "outline", className: pressable, onClick: () => respond(false), disabled: locked, children: "\u4E0D\u5141\u8BB8" })), !acceptsText && dismissButton] }), answerField, errorText] }));
    }
    // A question carries no decision to fabricate, so it renders only what the
    // request declared, even when that leaves nothing to act on here.
    if (question) {
        return (_jsxs("div", { "data-slot": "tool-fallback-approval", tabIndex: -1, className: cn("aui-tool-fallback-approval flex flex-col gap-2 pt-1", className), ...props, ref: setPendingGroup, children: [promptText, answerField, !acceptsText && dismissButton && (_jsx("div", { className: "flex items-center gap-2", children: dismissButton })), errorText] }));
    }
    return (_jsxs("div", { "data-slot": "tool-fallback-approval", tabIndex: -1, className: cn("aui-tool-fallback-approval flex flex-col gap-2 pt-1", className), ...props, ref: setPendingGroup, children: [promptText, _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { size: "sm", className: pressable, onClick: () => respond(true), disabled: locked, children: "\u5141\u8BB8" }), _jsx(Button, { size: "sm", variant: "outline", className: pressable, onClick: () => respond(false), disabled: locked, children: "\u4E0D\u5141\u8BB8" })] }), answerField, errorText] }));
}
const ToolFallbackImpl = ({ toolName, argsText, result, isError, status, responseDeliveryStatus, addResult, resume, interrupt, approval, respondToApproval, }) => {
    const isCancelled = status?.type === "incomplete" && status.reason === "cancelled";
    const isRequiresAction = status?.type === "requires-action";
    const shouldRenderApproval = approval != null ||
        (isRequiresAction && offersInterruptAction(status, approval, interrupt));
    const [open, setOpen] = useState(isRequiresAction);
    const [prevRequiresAction, setPrevRequiresAction] = useState(isRequiresAction);
    if (isRequiresAction !== prevRequiresAction) {
        setPrevRequiresAction(isRequiresAction);
        if (isRequiresAction)
            setOpen(true);
    }
    const approvalHadFocusRef = useRef(false);
    const approvalElementRef = useRef(null);
    const triggerRef = useRef(null);
    useLayoutEffect(() => {
        const focusedElement = approvalElementRef.current;
        if (!focusedElement ||
            focusedElement.isConnected ||
            isRequiresAction ||
            !approvalHadFocusRef.current) {
            return;
        }
        const shouldFocusTrigger = approval == null || !isSettled(approval);
        approvalHadFocusRef.current = false;
        const { activeElement, body } = focusedElement.ownerDocument;
        if (shouldFocusTrigger &&
            (activeElement == null || activeElement === body)) {
            triggerRef.current?.focus({ preventScroll: true });
        }
    }, [approval, isRequiresAction, status?.type]);
    return (_jsxs(ToolFallbackRoot, { open: open, onOpenChange: setOpen, children: [_jsx(ToolFallbackTrigger, { toolName: toolName, status: status, isError: isError, responseDeliveryStatus: responseDeliveryStatus }), _jsxs(ToolFallbackContent, { children: [_jsx(ToolFallbackError, { status: status }), _jsx(ToolFallbackArgs, { argsText: argsText, className: cn(isCancelled && "opacity-60") }), shouldRenderApproval && (_jsx(ToolFallbackApproval, { addResult: addResult, resume: resume, interrupt: interrupt, approval: approval, respondToApproval: respondToApproval, status: status, onFocusCapture: (event) => {
                            const root = event.currentTarget.closest('[data-slot="tool-fallback-root"]');
                            triggerRef.current =
                                root?.querySelector('[data-slot="tool-fallback-trigger"]') ?? null;
                            approvalElementRef.current = event.currentTarget;
                            approvalHadFocusRef.current = true;
                        }, onBlurCapture: (event) => {
                            const relatedTarget = event.relatedTarget;
                            const stillFocused = relatedTarget
                                ? event.currentTarget.contains(relatedTarget)
                                : event.currentTarget.contains(event.currentTarget.ownerDocument.activeElement);
                            if (!stillFocused)
                                approvalHadFocusRef.current = false;
                        } })), _jsx(ToolFallbackResult, { result: result })] })] }));
};
const ToolFallback = memo(ToolFallbackImpl);
ToolFallback.displayName = "ToolFallback";
ToolFallback.Root = ToolFallbackRoot;
ToolFallback.Trigger = ToolFallbackTrigger;
ToolFallback.Content = ToolFallbackContent;
ToolFallback.Args = ToolFallbackArgs;
ToolFallback.Result = ToolFallbackResult;
ToolFallback.Error = ToolFallbackError;
ToolFallback.Approval = ToolFallbackApproval;
export { formatUnknownValue, offersInterruptAction, ToolFallback, ToolFallbackRoot, ToolFallbackTrigger, ToolFallbackContent, ToolFallbackArgs, ToolFallbackResult, ToolFallbackError, ToolFallbackApproval, };
