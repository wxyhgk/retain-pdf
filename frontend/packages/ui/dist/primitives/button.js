import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../lib/utils.js";
function Spinner() {
    return _jsx("span", { className: "ui-button-spinner", "aria-hidden": "true" });
}
export function Button({ variant, size = "md", pending = false, type = "button", className, disabled, children, ...props }) {
    if (!variant) {
        return _jsx("button", { type: type, className: className, disabled: disabled, ...props, children: children });
    }
    return (_jsxs("button", { type: type, className: cn("ui-button", className), "data-variant": variant, "data-size": size, disabled: disabled || pending, "aria-busy": pending || undefined, ...props, children: [pending ? _jsx(Spinner, {}) : null, children] }));
}
export function IconButton({ label, variant = "ghost", size = "md", pending = false, type = "button", className, disabled, children, ...props }) {
    return (_jsx("button", { type: type, className: cn("ui-icon-button", className), "data-variant": variant, "data-size": size, "aria-label": label, title: label, disabled: disabled || pending, "aria-busy": pending || undefined, ...props, children: pending ? _jsx(Spinner, {}) : children }));
}
//# sourceMappingURL=button.js.map