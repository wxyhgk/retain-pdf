import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 选择类：Checkbox（勾选框，可带文字）、SegmentedControl（几个里选一个的一排按钮）。样子在 styles/choice.css。
//
// SegmentedControl 是 radiogroup：只有选中的那个能 Tab 到，左右方向键换选项（选中跟着走），和系统单选一样。
import { useRef } from "react";
import { cn } from "../lib/utils.js";
export function Checkbox({ label, className, ...props }) {
    if (!label)
        return _jsx("input", { type: "checkbox", className: cn("ui-checkbox-box", className), ...props });
    return (_jsxs("label", { className: cn("ui-checkbox", className), children: [_jsx("input", { type: "checkbox", className: "ui-checkbox-box", ...props }), _jsx("span", { className: "ui-checkbox-label", children: label })] }));
}
export function SegmentedControl({ value, options, onChange, label, size = "md", columns, disabled = false, className, }) {
    const group = useRef(null);
    const enabled = options.filter((option) => !option.disabled);
    function onKeyDown(event) {
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!step || !enabled.length)
            return;
        event.preventDefault();
        const at = enabled.findIndex((option) => option.value === value);
        const next = enabled[(at + step + enabled.length) % enabled.length];
        onChange(next.value);
        const buttons = group.current?.querySelectorAll("[data-segment-value]") || [];
        Array.from(buttons).find((button) => button.dataset.segmentValue === next.value)?.focus();
    }
    return (_jsx("div", { ref: group, className: cn("ui-segmented", className), role: "radiogroup", "aria-label": label, "data-size": size, "data-layout": columns ? "grid" : undefined, style: columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined, children: options.map((option) => {
            const checked = option.value === value;
            return (_jsx("button", { type: "button", role: "radio", "aria-checked": checked, tabIndex: checked ? 0 : -1, className: "ui-segmented-option", "data-segment-value": option.value, disabled: disabled || option.disabled, onClick: () => onChange(option.value), onKeyDown: onKeyDown, ...option.props, children: option.label }, option.value));
        }) }));
}
//# sourceMappingURL=choice.js.map