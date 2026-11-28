import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 标题栏的下拉（2026-11-27）：左边「主对话 ▾」那种对话菜单（宿主画里面的东西）和右边「···」都用它。
// 用 <details>：开合不用状态库，标题栏拖动时 Rnd 的 cancel 已经放过 summary；点外面、按 Esc 收起（<details> 自己只在点 summary 时开合）。
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@retainpdf/ui";
export function AskHeadMenu({ label, title, className, children, onOpenChange }) {
    const [open, setOpen] = useState(false);
    const root = useRef(null);
    const change = useRef(onOpenChange);
    change.current = onOpenChange;
    useEffect(() => {
        change.current?.(open);
        if (!open)
            return undefined;
        const onPointer = (event) => {
            if (!root.current?.contains(event.target))
                setOpen(false);
        };
        const onKey = (event) => {
            if (event.key !== "Escape")
                return;
            // 只收下拉，不关窗（AskWindow 的 Esc 看 defaultPrevented）。
            event.preventDefault();
            setOpen(false);
        };
        document.addEventListener("pointerdown", onPointer, true);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("pointerdown", onPointer, true);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [open]);
    const close = () => setOpen(false);
    return (_jsxs("details", { ref: root, className: `ask-head-menu${className ? ` ${className}` : ""}`, open: open, onToggle: (event) => setOpen(event.currentTarget.open), children: [_jsx("summary", { "aria-label": title, title: title, children: label }), _jsx("div", { className: "ask-head-menu-body", children: typeof children === "function" ? children(close) : children })] }));
}
/** 下拉里的一项：左边图标、名字（下面一行灰的说明）、右边可以再放一点东西（条数）。宿主的下拉（阅读页的对话菜单）也用它，不用直接写这里的类名。 */
export function AskHeadMenuItem({ icon, label, hint, trailing, current, disabled, onClick }) {
    return (_jsxs(Button, { className: "ask-head-menu-item", "data-current": current ? "true" : undefined, disabled: disabled, onClick: onClick, children: [icon ? _jsx("span", { className: "ask-head-menu-icon", children: icon }) : null, _jsxs("span", { className: "ask-head-menu-text", children: [_jsx("span", { children: label }), hint ? _jsx("small", { children: hint }) : null] }), trailing ? _jsx("small", { className: "ask-head-menu-trailing", children: trailing }) : null] }));
}
/** 标题栏右边的「···」：不常用的（阅读页：记忆）。没有项就不画。 */
export function AskMoreMenu({ items }) {
    if (!items.length)
        return null;
    return (_jsx(AskHeadMenu, { className: "ask-more", title: `更多：${items.map((item) => item.label).join("、")}`, label: _jsx(MoreHorizontal, { size: 15, "aria-hidden": true }), children: (close) => items.map((item) => (_jsx(AskHeadMenuItem, { icon: item.icon, label: item.label, hint: item.hint, onClick: () => {
                close();
                item.onSelect();
            } }, item.key))) }));
}
