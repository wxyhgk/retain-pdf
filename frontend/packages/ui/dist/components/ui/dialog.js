"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { LegacyButton } from "./button.js";
import { cn } from "../../lib/utils.js";
const dialogSizeClass = {
    compact: "app-dialog-size-compact",
    standard: "app-dialog-size-standard",
    wide: "app-dialog-size-wide",
    workspace: "app-dialog-size-workspace",
};
const dialogLevelClass = {
    base: "app-dialog-level-base",
    nested: "app-dialog-level-nested",
};
function Dialog({ ...props }) {
    return _jsx(DialogPrimitive.Root, { "data-slot": "dialog", ...props });
}
function DialogTrigger({ ...props }) {
    return _jsx(DialogPrimitive.Trigger, { "data-slot": "dialog-trigger", ...props });
}
function DialogPortal({ ...props }) {
    return _jsx(DialogPrimitive.Portal, { "data-slot": "dialog-portal", ...props });
}
function DialogClose({ ...props }) {
    return _jsx(DialogPrimitive.Close, { "data-slot": "dialog-close", ...props });
}
function DialogOverlay({ className, level = "base", ...props }) {
    return (_jsx(DialogPrimitive.Overlay, { "data-slot": "dialog-overlay", className: cn("app-dialog-overlay", dialogLevelClass[level], className), ...props }));
}
function DialogContent({ className, children, level = "base", overlayClassName, showCloseButton = true, size = "standard", ...props }) {
    return (_jsxs(DialogPortal, { children: [_jsx(DialogOverlay, { className: overlayClassName, level: level }), _jsxs(DialogPrimitive.Content, { "data-slot": "dialog-content", className: cn("app-dialog-content", dialogSizeClass[size], dialogLevelClass[level], className), ...props, children: [children, showCloseButton ? _jsx(DialogCloseButton, {}) : null] })] }));
}
function DialogShell({ className, ...props }) {
    return _jsx("div", { "data-slot": "dialog-shell", className: cn("app-dialog-shell", className), ...props });
}
function DialogHeader({ className, ...props }) {
    return _jsx("div", { "data-slot": "dialog-header", className: cn("app-dialog-header", className), ...props });
}
function DialogBody({ className, ...props }) {
    return _jsx("div", { "data-slot": "dialog-body", className: cn("app-dialog-body", className), ...props });
}
function DialogFooter({ className, showCloseButton = false, children, ...props }) {
    return (_jsxs("div", { "data-slot": "dialog-footer", className: cn("app-dialog-footer", className), ...props, children: [children, showCloseButton ? (_jsx(DialogPrimitive.Close, { asChild: true, children: _jsx(LegacyButton, { variant: "outline", children: "\u5173\u95ED" }) })) : null] }));
}
function DialogCloseButton({ children, className, ...props }) {
    return (_jsxs(DialogPrimitive.Close, { "aria-label": "\u5173\u95ED", "data-slot": "dialog-close-button", className: cn("app-dialog-close", className), ...props, children: [children ?? _jsx(XIcon, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "\u5173\u95ED" })] }));
}
function DialogTitle({ className, ...props }) {
    return (_jsx(DialogPrimitive.Title, { "data-slot": "dialog-title", className: cn("app-dialog-title", className), ...props }));
}
function DialogDescription({ className, ...props }) {
    return (_jsx(DialogPrimitive.Description, { "data-slot": "dialog-description", className: cn("app-dialog-description", className), ...props }));
}
export { Dialog, DialogBody, DialogClose, DialogCloseButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogShell, DialogTitle, DialogTrigger, };
//# sourceMappingURL=dialog.js.map