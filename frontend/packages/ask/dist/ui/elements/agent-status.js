import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CheckIcon, PauseIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { cn } from "../lib/utils.js";
import { mono, paper } from "./surfaces.js";
export function AgentStatus({ state, label, elapsed, trailing, className, ...props }) {
    return (_jsxs("span", { "data-slot": "agent-status", className: cn(paper, "flex items-center gap-2.5 rounded-full py-1.5 ps-3.5 pe-1.5", className), ...props, children: [state === "done" ? (_jsx(CheckIcon, { "aria-hidden": true, className: "size-3 shrink-0 text-emerald-500" })) : state === "failed" ? (_jsx(XIcon, { "aria-hidden": true, className: "text-destructive size-3 shrink-0" })) : (_jsx("span", { "aria-hidden": true, className: cn("size-1.5 shrink-0 rounded-full motion-reduce:animate-none", state === "working"
                    ? "animate-pulse bg-blue-500 dark:bg-blue-400"
                    : "border-foreground/35 border") })), _jsx("span", { className: "sr-only", children: { working: "进行中", waiting: "等着", done: "完成", failed: "失败" }[state] }), _jsx("span", { className: "fade-in blur-in-[2px] animate-in max-w-44 truncate text-xs duration-300 motion-reduce:animate-none", children: label }, label), elapsed !== undefined && state !== "done" && state !== "failed" && (_jsx("span", { className: cn(mono, "text-muted-foreground tabular-nums"), children: elapsed })), _jsx("span", { "aria-hidden": true, "data-slot": "agent-status-trailing", className: "text-muted-foreground flex size-6 items-center justify-center rounded-full", children: trailing !== undefined ? (trailing) : state === "done" || state === "failed" ? (_jsx(RotateCcwIcon, { className: "size-3" })) : (_jsx(PauseIcon, { className: "size-3" })) })] }));
}
