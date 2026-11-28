import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 贴右边时画进宿主给的那一栏（2026-11-28：阅读页的右边停靠栏 .reader-dock，和 Markdown 面板共用一个容器）。
// 不再是一个 fixed 的浮窗盖在页面右边：没有投影、圆角，左边一条线就是分栏线，拖它改宽窄（宽度照旧记在本机）。
import { useRef } from "react";
const MIN_WIDTH = 320;
/** 至少给宿主留这么宽（拖得再宽也不把页面挤没）。 */
const KEEP_FOR_HOST = 360;
export function HostedDock({ width, onResize, children }) {
    const drag = useRef(null);
    const clamp = (value) => Math.round(Math.min(Math.max(value, MIN_WIDTH), Math.max(MIN_WIDTH, (globalThis.innerWidth || 1200) - KEEP_FOR_HOST)));
    const onPointerDown = (event) => {
        drag.current = { startX: event.clientX, startWidth: width };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    };
    const onPointerMove = (event) => {
        if (!drag.current)
            return;
        onResize(clamp(drag.current.startWidth - (event.clientX - drag.current.startX)), false);
    };
    const onPointerUp = (event) => {
        if (!drag.current)
            return;
        onResize(clamp(drag.current.startWidth - (event.clientX - drag.current.startX)), true);
        drag.current = null;
    };
    return (_jsxs("div", { className: "ask-window ask-window--hosted", children: [_jsx("div", { className: "ask-dock-resizer", role: "separator", "aria-orientation": "vertical", "aria-label": "\u62D6\u52A8\u6539\u63D0\u95EE\u7A97\u5BBD\u7A84", onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp }), children] }));
}
