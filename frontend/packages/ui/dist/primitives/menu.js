import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 点开的选项列表（radix DropdownMenu）：键盘上下选、回车选中、Esc 关、焦点回到按钮。样子在 styles/menu.css。
//
// trigger 是一个按钮元素（通常是 Button 或 IconButton），由 Menu 接上开关。
import { DropdownMenu } from "radix-ui";
import { cn } from "../lib/utils.js";
export function Menu({ trigger, items, align = "start", label, className, open, onOpenChange }) {
    return (_jsxs(DropdownMenu.Root, { open: open, onOpenChange: onOpenChange, children: [_jsx(DropdownMenu.Trigger, { asChild: true, children: trigger }), _jsx(DropdownMenu.Portal, { children: _jsx(DropdownMenu.Content, { className: cn("ui-menu", className), align: align, sideOffset: 4, "aria-label": label, children: items.map((item) => (_jsxs(DropdownMenu.Item, { className: "ui-menu-item", disabled: item.disabled, "data-danger": item.danger ? "true" : undefined, onSelect: () => item.onSelect(), children: [item.icon ? _jsx("span", { className: "ui-menu-icon", "aria-hidden": "true", children: item.icon }) : null, _jsx("span", { className: "ui-menu-label", children: item.label })] }, item.key))) }) })] }));
}
//# sourceMappingURL=menu.js.map