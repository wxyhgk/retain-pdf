import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 输入：Field 管标题、说明、错误，Input / Textarea / Select 只管框。样子在 styles/field.css。
//
// Field 把标题和说明接到里面那个控件上（id、aria-describedby、aria-invalid），调用方不用自己拼。
// Select 是原生 <select> 加一个箭头：手机上原生的最好用，不做自绘下拉。
import { ChevronDown } from "lucide-react";
import { Children, cloneElement, isValidElement, useId } from "react";
import { cn } from "../lib/utils.js";
export function Field({ label, hint, error, className, children }) {
    const autoId = useId();
    const control = Children.only(children);
    const controlId = (isValidElement(control) && control.props.id) || `${autoId}-control`;
    const hintId = hint ? `${autoId}-hint` : "";
    const errorId = error ? `${autoId}-error` : "";
    const describedBy = [control.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
    return (_jsxs("div", { className: cn("ui-field", className), "data-invalid": error ? "true" : undefined, children: [_jsx("label", { className: "ui-field-label", htmlFor: controlId, children: label }), hint ? _jsx("p", { id: hintId, className: "ui-field-hint", children: hint }) : null, cloneElement(control, {
                id: controlId,
                "aria-describedby": describedBy,
                ...(error ? { "aria-invalid": true } : {}),
            }), error ? _jsx("p", { id: errorId, className: "ui-field-error", role: "alert", children: error }) : null] }));
}
export function Input({ size = "md", className, ...props }) {
    return _jsx("input", { className: cn("ui-input", className), "data-size": size, ...props });
}
export function Textarea({ className, ...props }) {
    return _jsx("textarea", { className: cn("ui-textarea", className), ...props });
}
export function Select({ size = "md", className, children, ...props }) {
    return (_jsxs("span", { className: cn("ui-select", className), "data-size": size, children: [_jsx("select", { ...props, children: children }), _jsx(ChevronDown, { className: "ui-select-arrow", "aria-hidden": "true" })] }));
}
//# sourceMappingURL=field.js.map