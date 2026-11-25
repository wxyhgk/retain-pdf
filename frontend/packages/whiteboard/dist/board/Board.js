import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 无限白板：拖空白处移动、⌘/Ctrl + 滚轮（触控板捏合）以鼠标为中心缩放、两指滑动 / 滚轮平移；
// 双击空白处放一张文字卡片，双击卡片改字。卡片里直接写 Markdown，公式用 $…$（MathMarkdownEditor）。
//
// 白板的数据由外面管（doc / onChange），这样阅读页可以按书存；演示页用 useBoardStorage 存在本机。
// 键盘（白板有焦点、没在写字时）：Delete / ⌫ 删选中的卡片，回车改它，Esc 取消选中，⌘/Ctrl+Z 撤销、⇧ 重做。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@retainpdf/ui";
import { Maximize2, Minus, Plus, Type } from "lucide-react";
import { addNote, bringToFront, fitView, panBy, removeItem, screenToWorld, updateItem, zoomAt, } from "./board-state.js";
import { MathMarkdownEditor } from "./MathMarkdownEditor.js";
import { renderMathMarkdown } from "../markdown/math-markdown.js";
import { loadMathEngine, mathEngineReady } from "../math/engine.js";
const HISTORY_LIMIT = 100;
const DRAG_THRESHOLD = 3;
function useEngineVersion() {
    const [version, setVersion] = useState(mathEngineReady() ? 1 : 0);
    useEffect(() => {
        if (version)
            return undefined;
        let cancelled = false;
        loadMathEngine().then(() => {
            if (!cancelled)
                setVersion(1);
        }, () => { });
        return () => {
            cancelled = true;
        };
    }, [version]);
    return version;
}
export function Board({ doc, onChange, className, label = "白板" }) {
    const engineVersion = useEngineVersion();
    const rootRef = useRef(null);
    const [selected, setSelected] = useState(null);
    const [editing, setEditing] = useState(null);
    const gesture = useRef(null);
    const heights = useRef(new Map());
    // 撤销只管卡片（移动视图不算）。
    const history = useRef({ past: [], future: [] });
    const docRef = useRef(doc);
    docRef.current = doc;
    const commit = useCallback((next, record = true) => {
        if (record && next.items !== docRef.current.items) {
            history.current.past.push(docRef.current.items);
            if (history.current.past.length > HISTORY_LIMIT)
                history.current.past.shift();
            history.current.future = [];
        }
        onChange(next);
    }, [onChange]);
    const setView = useCallback((view) => onChange({ ...docRef.current, view }), [onChange]);
    const finishEditing = useCallback(() => {
        if (!editing)
            return;
        const item = docRef.current.items.find((entry) => entry.id === editing);
        setEditing(null);
        if (item && !item.text.trim()) {
            commit(removeItem(docRef.current, item.id));
            setSelected(null);
        }
        rootRef.current?.focus();
    }, [editing, commit]);
    const point = (event) => {
        const rect = rootRef.current.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const createAt = (screen) => {
        const world = screenToWorld(docRef.current.view, screen);
        const { doc: next, id } = addNote(docRef.current, { x: world.x - 12, y: world.y - 16 });
        commit(next);
        setSelected(id);
        setEditing(id);
    };
    // 滚轮：⌘/Ctrl（触控板捏合也是带 Ctrl 的滚轮）缩放，其余平移。要非被动监听才能挡住页面滚动。
    useEffect(() => {
        const root = rootRef.current;
        if (!root)
            return undefined;
        const onWheel = (event) => {
            const target = event.target;
            if (target?.closest(".wbm-editor"))
                return;
            event.preventDefault();
            const rect = root.getBoundingClientRect();
            const at = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            const view = docRef.current.view;
            if (event.ctrlKey || event.metaKey) {
                // 触控板捏合给的是很小的连续值，鼠标滚轮一格是 100 左右：每次最多算 ±25，一格约缩放 22%。
                const delta = Math.max(-25, Math.min(25, event.deltaY * (event.deltaMode === 1 ? 16 : 1)));
                setView(zoomAt(view, at, view.zoom * Math.exp(-delta * 0.01)));
            }
            else {
                setView(panBy(view, -event.deltaX, -event.deltaY));
            }
        };
        root.addEventListener("wheel", onWheel, { passive: false });
        return () => root.removeEventListener("wheel", onWheel);
    }, [setView]);
    const onBackgroundPointerDown = (event) => {
        if (event.button !== 0)
            return;
        if (event.target.closest(".wbb-card, .wbb-toolbar"))
            return;
        finishEditing();
        setSelected(null);
        gesture.current = { kind: "pan", startX: event.clientX, startY: event.clientY, view: docRef.current.view };
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event) => {
        const current = gesture.current;
        if (!current)
            return;
        if (current.kind === "pan") {
            setView({ ...current.view, x: current.view.x + event.clientX - current.startX, y: current.view.y + event.clientY - current.startY });
        }
        else if (current.kind === "move") {
            const dx = event.clientX - current.startX;
            const dy = event.clientY - current.startY;
            if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD)
                return;
            const zoom = docRef.current.view.zoom;
            const next = updateItem(docRef.current, current.id, { x: Math.round(current.itemX + dx / zoom), y: Math.round(current.itemY + dy / zoom) });
            // 一次拖动只记一步撤销。
            commit(next, !current.moved);
            current.moved = true;
        }
        else {
            const zoom = docRef.current.view.zoom;
            commit(updateItem(docRef.current, current.id, { w: current.width + (event.clientX - current.startX) / zoom }), false);
        }
    };
    const onPointerUp = () => {
        gesture.current = null;
    };
    const onCardPointerDown = (event, item) => {
        if (event.button !== 0)
            return;
        if (editing === item.id)
            return;
        finishEditing();
        event.stopPropagation();
        setSelected(item.id);
        const front = bringToFront(docRef.current, item.id);
        if (front !== docRef.current)
            onChange(front);
        gesture.current = { kind: "move", id: item.id, startX: event.clientX, startY: event.clientY, itemX: item.x, itemY: item.y, moved: false };
        rootRef.current?.setPointerCapture(event.pointerId);
        rootRef.current?.focus();
    };
    const onResizePointerDown = (event, item) => {
        event.stopPropagation();
        if (event.button !== 0)
            return;
        // 记一步撤销，拖的过程中不再记。
        commit(updateItem(docRef.current, item.id, { w: item.w }));
        gesture.current = { kind: "resize", id: item.id, startX: event.clientX, width: item.w };
        rootRef.current?.setPointerCapture(event.pointerId);
    };
    const undo = (redo) => {
        const { past, future } = history.current;
        const from = redo ? future : past;
        const to = redo ? past : future;
        const items = from.pop();
        if (!items)
            return;
        to.push(docRef.current.items);
        onChange({ ...docRef.current, items });
    };
    const onKeyDown = (event) => {
        if (editing || event.target.closest(".wbm-editor"))
            return;
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            undo(event.shiftKey);
            return;
        }
        if (!selected)
            return;
        if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            commit(removeItem(docRef.current, selected));
            setSelected(null);
        }
        else if (event.key === "Enter") {
            event.preventDefault();
            setEditing(selected);
        }
        else if (event.key === "Escape") {
            setSelected(null);
        }
    };
    // 量卡片高度（「看全部」要用）。
    const measure = useCallback((id) => (node) => {
        if (node)
            heights.current.set(id, node.offsetHeight);
    }, []);
    const size = () => {
        const rect = rootRef.current?.getBoundingClientRect();
        return { w: rect?.width ?? 0, h: rect?.height ?? 0 };
    };
    const fitAll = () => setView(fitView(docRef.current.items, size(), heights.current));
    const zoomBy = (factor) => {
        const { w, h } = size();
        setView(zoomAt(docRef.current.view, { x: w / 2, y: h / 2 }, docRef.current.view.zoom * factor));
    };
    const addAtCenter = () => {
        const { w, h } = size();
        createAt({ x: w / 2 - 140, y: h / 2 - 40 });
    };
    // 第一次打开、视图还在原点时把东西移到眼前。
    useLayoutEffect(() => {
        const { view, items } = docRef.current;
        if (items.length && view.x === 0 && view.y === 0 && view.zoom === 1)
            fitAll();
    }, []);
    const { view } = doc;
    const rendered = useMemo(() => new Map(doc.items.map((item) => [item.id, renderMathMarkdown(item.text)])), [doc.items, engineVersion]);
    const gridSize = 24 * view.zoom;
    return (_jsxs("div", { ref: rootRef, className: `wbb-root${className ? ` ${className}` : ""}`, tabIndex: 0, role: "application", "aria-label": label, style: { backgroundSize: `${gridSize}px ${gridSize}px`, backgroundPosition: `${view.x}px ${view.y}px` }, onPointerDown: onBackgroundPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp, onDoubleClick: (event) => {
            if (event.target.closest(".wbb-card, .wbb-toolbar"))
                return;
            createAt(point(event));
        }, onKeyDown: onKeyDown, "data-wbb-count": doc.items.length, children: [_jsx("div", { className: "wbb-world", style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }, children: doc.items.map((item) => {
                    const isEditing = editing === item.id;
                    return (_jsxs("div", { ref: measure(item.id), className: `wbb-card${selected === item.id ? " is-selected" : ""}${isEditing ? " is-editing" : ""}`, style: { left: item.x, top: item.y, width: item.w }, "data-wbb-id": item.id, onPointerDown: (event) => onCardPointerDown(event, item), onDoubleClick: (event) => {
                            event.stopPropagation();
                            setSelected(item.id);
                            setEditing(item.id);
                        }, children: [isEditing ? (_jsx(MathMarkdownEditor, { value: item.text, autoFocus: true, onChange: (text) => commit(updateItem(docRef.current, item.id, { text }), false), onDone: finishEditing })) : (_jsx("div", { className: "wbb-card-body wbm-rendered", 
                                // Markdown 里的原始 HTML 已转义、公式 SVG 已清洗（math-markdown.ts）。
                                dangerouslySetInnerHTML: { __html: rendered.get(item.id) || "<p class=\"wbb-empty\">（空）</p>" } })), _jsx("span", { className: "wbb-resize", "aria-hidden": "true", onPointerDown: (event) => onResizePointerDown(event, item) })] }, item.id));
                }) }), !doc.items.length ? _jsx("p", { className: "wbb-hint", children: "\u53CC\u51FB\u7A7A\u767D\u5904\u5199\u5B57\uFF0C\u516C\u5F0F\u7528 $\u2026$\uFF08\u6253 \\fr \u6709\u8865\u5168\uFF09\u3002" }) : null, _jsxs("div", { className: "wbb-toolbar", onPointerDown: (event) => event.stopPropagation(), children: [_jsx(Button, { variant: "secondary", size: "sm", "aria-label": "\u653E\u4E00\u5F20\u6587\u5B57\u5361\u7247", title: "\u653E\u4E00\u5F20\u6587\u5B57\u5361\u7247\uFF08\u4E5F\u53EF\u4EE5\u53CC\u51FB\u7A7A\u767D\u5904\uFF09", onClick: addAtCenter, children: _jsx(Type, { "aria-hidden": "true" }) }), _jsx(Button, { variant: "secondary", size: "sm", "aria-label": "\u7F29\u5C0F", onClick: () => zoomBy(1 / 1.2), children: _jsx(Minus, { "aria-hidden": "true" }) }), _jsxs(Button, { variant: "secondary", size: "sm", className: "wbb-zoom", "aria-label": "\u7F29\u653E\u6BD4\u4F8B\uFF0C\u70B9\u4E00\u4E0B\u56DE\u5230 100%", onClick: () => {
                            const { w, h } = size();
                            setView(zoomAt(view, { x: w / 2, y: h / 2 }, 1));
                        }, children: [Math.round(view.zoom * 100), "%"] }), _jsx(Button, { variant: "secondary", size: "sm", "aria-label": "\u653E\u5927", onClick: () => zoomBy(1.2), children: _jsx(Plus, { "aria-hidden": "true" }) }), _jsx(Button, { variant: "secondary", size: "sm", "aria-label": "\u770B\u5168\u90E8", title: "\u770B\u5168\u90E8", onClick: fitAll, children: _jsx(Maximize2, { "aria-hidden": "true" }) })] })] }));
}
