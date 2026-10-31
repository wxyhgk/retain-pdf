import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 从一边滑出的抽屉（radix Dialog）：焦点关在里面、Esc 和点外面关、关掉后焦点回到打开它的按钮。
// 给阅读器的面板、窄屏上的侧栏用；居中的弹窗用 Dialog。样子在 styles/sheet.css。
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "../lib/utils.js";
import { IconButton } from "./button.js";
export function Sheet({ open, onOpenChange, title, description, side = "right", id, className, children }) {
    return (_jsx(DialogPrimitive.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogPrimitive.Portal, { children: [_jsx(DialogPrimitive.Overlay, { className: "ui-sheet-overlay" }), _jsxs(DialogPrimitive.Content, { id: id, className: cn("ui-sheet", className), "data-side": side, ...(description ? {} : { "aria-describedby": undefined }), children: [_jsxs("header", { className: "ui-sheet-head", children: [_jsx(DialogPrimitive.Title, { className: "ui-sheet-title", children: title }), _jsx(DialogPrimitive.Close, { asChild: true, children: _jsx(IconButton, { label: "\u5173\u95ED", size: "sm", children: _jsx(X, { "aria-hidden": "true" }) }) })] }), description ? _jsx(DialogPrimitive.Description, { className: "ui-sheet-description", children: description }) : null, _jsx("div", { className: "ui-sheet-body", children: children })] })] }) }));
}
//# sourceMappingURL=sheet.js.map