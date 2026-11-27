// 提问窗的摆法（2026-11-27 从 AskWindow 拆出）：浮动（自己的位置大小）、贴右边（占满右侧，左边框拖宽窄）、放大。
// 浮动位置、贴右边的宽度、摆法记在本机（window-memory.ts），重开照旧；放大不记，「还原」回到放大前的摆法。
// 摆法变了交给宿主（onLayout），宿主据此给书页让出右边。
import { useCallback, useEffect, useRef, useState } from "react";
import { fitRect, loadWindowMemory, saveWindowMemory } from "./window-memory.js";
/** 贴右边时顶上让出宿主页面的顶栏（RetainPDF 阅读页的顶栏约 64px）。 */
const DOCK_TOP = 64;
const DOCK_WIDTH = 440;
function viewport() {
    return { width: globalThis.innerWidth || 1200, height: globalThis.innerHeight || 800 };
}
function floatRect() {
    const remembered = loadWindowMemory().float;
    if (remembered)
        return fitRect(remembered, viewport());
    const { width: vw, height: vh } = viewport();
    const width = Math.min(500, vw - 32);
    const height = Math.min(640, vh - 120);
    return { x: Math.max(16, vw - width - 24), y: 72, width, height };
}
/** 三种摆法的位置：浮动用自己记的；贴右边占满右侧（宽可以拖）；放大差不多占满屏。 */
function layoutFor(mode, float, dockWidth) {
    const { width: vw, height: vh } = viewport();
    if (mode === "dock") {
        const width = Math.min(dockWidth, vw - 16);
        return { x: vw - width, y: DOCK_TOP, width, height: vh - DOCK_TOP };
    }
    if (mode === "full")
        return { x: 16, y: 16, width: vw - 32, height: vh - 32 };
    return float;
}
export function useWindowLayout(onLayout) {
    const [mode, setMode] = useState(() => loadWindowMemory().mode || "float");
    const [float, setFloat] = useState(floatRect);
    const [dockWidth, setDockWidth] = useState(() => loadWindowMemory().dockWidth || DOCK_WIDTH);
    const changeMode = useCallback((next) => {
        setMode((current) => {
            const target = current === "full" && next === "float" ? loadWindowMemory().mode || "float" : next;
            if (target !== "full")
                saveWindowMemory({ mode: target });
            return target;
        });
    }, []);
    // 浏览器窗口大小变了重新排。
    const [, setResized] = useState(0);
    useEffect(() => {
        const onResize = () => setResized((value) => value + 1);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    const rect = layoutFor(mode, float, dockWidth);
    const listener = useRef(onLayout);
    listener.current = onLayout;
    useEffect(() => {
        listener.current?.({ mode, width: rect.width });
    }, [mode, rect.width]);
    const onDragStop = useCallback((_event, data) => setFloat((current) => {
        const next = { ...current, x: data.x, y: data.y };
        saveWindowMemory({ float: next });
        return next;
    }), []);
    const onResizeStop = useCallback((_event, _direction, element, _delta, position) => {
        if (mode === "dock") {
            setDockWidth(element.offsetWidth);
            saveWindowMemory({ dockWidth: element.offsetWidth });
        }
        else if (mode === "float") {
            const next = { x: position.x, y: position.y, width: element.offsetWidth, height: element.offsetHeight };
            setFloat(next);
            saveWindowMemory({ float: next });
        }
    }, [mode]);
    return { mode, rect, changeMode, onDragStop, onResizeStop };
}
