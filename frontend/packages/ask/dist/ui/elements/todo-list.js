import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
// RetainPDF 的改动（提示文字换中文）。
import { useId, useState } from "react";
import { CheckIcon, Loader2Icon, MinusIcon, XIcon } from "lucide-react";
import { cn } from "../lib/utils.js";
import { ghostButton, mono } from "./surfaces.js";
import { clamp } from "../utils/range.js";
export function TodoList({ items, revision, title = "计划", description, maxVisible, className, ...props }) {
    const done = items.filter((item) => item.status === "done").length;
    const total = items.filter((item) => item.status !== "cancelled").length;
    const visibleCount = Math.floor(clamp(maxVisible ?? items.length, 0, items.length));
    const [expanded, setExpanded] = useState(false);
    const listId = useId();
    const hiddenItems = items.filter((item, index) => index >= visibleCount &&
        item.status !== "active" &&
        item.status !== "failed");
    const canFold = maxVisible !== undefined && hiddenItems.length > 0;
    return (_jsxs("div", { "data-slot": "todo-list", className: cn("flex w-full max-w-sm flex-col gap-3", className), ...props, children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("span", { className: "text-[13.5px] font-medium", children: title }), description ? (_jsx("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: description })) : null] }), _jsx("span", { className: cn(mono, "text-muted-foreground shrink-0 whitespace-nowrap tabular-nums"), children: revision === undefined
                            ? `${done}/${total}`
                            : `${done}/${total} · 第 ${revision} 版` })] }), _jsx("ul", { id: listId, className: "flex flex-col gap-1", children: items.map((item, index) => {
                    const collapsed = canFold &&
                        index >= visibleCount &&
                        item.status !== "active" &&
                        item.status !== "failed";
                    const rowClassName = "fade-in slide-in-from-bottom-1 animate-in fill-mode-both flex items-start gap-2.5 py-0.5 text-[13.5px] duration-300 motion-reduce:animate-none";
                    const row = (_jsxs(_Fragment, { children: [_jsx("span", { "aria-hidden": true, className: "flex size-4 h-5 shrink-0 items-center justify-center", children: item.status === "done" ? (_jsx("span", { className: "border-foreground/20 bg-foreground/[0.06] flex size-3.5 items-center justify-center rounded-[5px] border", children: _jsx(CheckIcon, { className: "text-muted-foreground size-2.5" }) })) : item.status === "failed" ? (_jsx("span", { className: "flex size-3.5 items-center justify-center rounded-[5px] border border-red-600/25 bg-red-600/[0.08] dark:border-red-400/25 dark:bg-red-400/[0.08]", children: _jsx(XIcon, { className: "size-2.5 text-red-600 dark:text-red-400" }) })) : item.status === "cancelled" ? (_jsx("span", { className: "border-foreground/15 text-muted-foreground flex size-3.5 items-center justify-center rounded-[5px] border", children: _jsx(MinusIcon, { className: "size-2.5" }) })) : item.status === "active" ? (_jsx(Loader2Icon, { className: "size-3.5 animate-spin text-blue-500 motion-reduce:animate-none dark:text-blue-400" })) : (_jsx("span", { className: "border-foreground/15 size-3.5 rounded-[5px] border" })) }), _jsx("span", { className: "sr-only", children: item.status }), _jsxs("div", { className: "min-w-0 flex-1 leading-5 break-words", children: [_jsx("span", { className: cn(item.status === "done" &&
                                            "text-muted-foreground line-through decoration-[1.5px]", item.status === "active" && "text-foreground/90", item.status === "pending" && "text-muted-foreground", item.status === "failed" &&
                                            "text-red-600 dark:text-red-400", item.status === "cancelled" &&
                                            "text-muted-foreground line-through decoration-[1.5px]"), children: item.text }), item.status === "failed" ? (item.reason ? (_jsx("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: item.reason })) : null) : item.status !== "cancelled" && item.description ? (_jsx("p", { className: "text-muted-foreground text-xs leading-4 break-words", children: item.description })) : null] })] }));
                    if (collapsed && !expanded)
                        return null;
                    return (_jsx("li", { "data-status": item.status, className: rowClassName, children: row }, item.id));
                }) }), canFold ? (_jsx("button", { type: "button", "aria-expanded": expanded, "aria-controls": listId, onClick: () => setExpanded((current) => !current), className: cn(ghostButton, "self-start px-2 py-1 text-xs font-medium"), children: expanded ? "收起" : `还有 ${hiddenItems.length} 项` })) : null] }));
}
