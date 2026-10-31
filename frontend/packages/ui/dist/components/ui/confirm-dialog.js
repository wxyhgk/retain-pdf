"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle, Info } from "lucide-react";
import { LegacyButton } from "./button.js";
import { Dialog, DialogBody, DialogCloseButton, DialogContent, DialogFooter, DialogHeader, DialogShell, DialogTitle, } from "./dialog.js";
function ConfirmDialog({ cancelLabel = "取消", confirmLabel = "确认", description, id, level = "base", onConfirm, onOpenChange, open, pending = false, size = "compact", title, tone = "default", }) {
    const ToneIcon = tone === "info" ? Info : AlertTriangle;
    return (_jsx(Dialog, { open: open, onOpenChange: (nextOpen) => {
            if (!pending)
                onOpenChange(nextOpen);
        }, children: _jsx(DialogContent, { id: id, showCloseButton: false, size: size, level: level, children: _jsxs(DialogShell, { children: [_jsxs(DialogHeader, { children: [_jsxs("div", { className: "app-confirm-heading", children: [_jsx("span", { className: `app-confirm-icon app-confirm-icon-${tone}`, "aria-hidden": "true", children: _jsx(ToneIcon, { className: "h-4 w-4" }) }), _jsx(DialogTitle, { children: title })] }), _jsx(DialogCloseButton, { disabled: pending })] }), _jsx(DialogBody, { className: "app-confirm-body", children: _jsx("div", { className: "app-confirm-description", children: description }) }), _jsxs(DialogFooter, { children: [_jsx(LegacyButton, { type: "button", variant: "outline", disabled: pending, onClick: () => onOpenChange(false), children: cancelLabel }), _jsx(LegacyButton, { id: `${id}-confirm`, type: "button", variant: tone === "danger" ? "destructive" : "default", disabled: pending, onClick: onConfirm, children: pending ? "处理中…" : confirmLabel })] })] }) }) }));
}
export { ConfirmDialog };
//# sourceMappingURL=confirm-dialog.js.map