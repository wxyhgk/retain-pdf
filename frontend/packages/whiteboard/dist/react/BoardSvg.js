import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LAYOUT } from "../layout/layout.js";
import { FONT_SIZE, LINE_HEIGHT } from "../layout/measure.js";
function safeId(value) {
    return value.replace(/[^A-Za-z0-9_-]/g, "_");
}
function toneClass(tone) {
    return tone ? `wb-tone-${tone}` : "wb-tone-ink";
}
function Reveal({ id, box, progress, children }) {
    if (progress >= 1)
        return _jsx(_Fragment, { children: children });
    return (_jsxs(_Fragment, { children: [_jsx("clipPath", { id: id, children: _jsx("rect", { x: box.x - 4, y: box.y - 8, width: Math.max(0, (box.w + 8) * progress), height: box.h + 16 }) }), _jsx("g", { clipPath: `url(#${id})`, children: children })] }));
}
function WriteView({ item, math, idPrefix }) {
    const { op, box } = item;
    const size = op.size ?? "m";
    const fontSize = FONT_SIZE[size];
    const clip = `${idPrefix}-clip-${safeId(item.key)}`;
    let body;
    if (op.math !== undefined) {
        const rendered = math(op.math, size);
        if (rendered && !rendered.error && rendered.svg) {
            body = (_jsx("g", { className: "wb-math", transform: `translate(${box.x} ${box.y + (box.h - rendered.h) / 2})`, 
                // MathJax 排出来、去掉了链接和事件属性的 SVG（engine.ts 的 sanitizeMathSvg）。
                dangerouslySetInnerHTML: { __html: rendered.svg } }));
        }
        else {
            body = (_jsx("text", { className: "wb-text wb-math-error", x: box.x, y: box.y + box.h / 2, fontSize: fontSize, dominantBaseline: "central", children: op.math }));
        }
    }
    else {
        body = (_jsx("text", { className: `wb-text wb-size-${size}`, x: box.x, y: box.y + box.h / 2, fontSize: fontSize, dominantBaseline: "central", children: op.text }));
    }
    return (_jsx("g", { className: "wb-item wb-write", "data-wb-id": op.id, opacity: item.opacity, children: _jsx(Reveal, { id: clip, box: box, progress: item.progress, children: body }) }));
}
function MarkView({ item }) {
    const { box, op } = item;
    const style = op.style ?? "box";
    const p = item.progress;
    const cls = `wb-item wb-mark wb-mark-${style} ${toneClass(item.tone)}`;
    if (style === "highlight") {
        return (_jsx("rect", { className: cls, x: box.x - 6, y: box.y - 4, width: (box.w + 12) * p, height: box.h + 8, rx: 6, opacity: item.opacity }));
    }
    if (style === "underline") {
        const y = box.y + box.h + 4;
        return _jsx("path", { className: cls, d: `M ${box.x} ${y} L ${box.x + box.w} ${y}`, pathLength: 1, strokeDasharray: "1", strokeDashoffset: 1 - p, opacity: item.opacity });
    }
    return (_jsx("rect", { className: cls, x: box.x - 8, y: box.y - 6, width: box.w + 16, height: box.h + 12, rx: 10, pathLength: 1, strokeDasharray: "1", strokeDashoffset: 1 - p, opacity: item.opacity }));
}
/** 箭头从哪条边出、到哪条边：目标在下面就上下连，在右边就左右连，否则连中心。 */
export function arrowEnds(from, to) {
    const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    // 上下连时，两个东西左右有重叠就竖直画（取重叠段中间），不斜着穿过公式。
    const left = Math.max(from.x, to.x);
    const right = Math.min(from.x + from.w, to.x + to.w);
    const sharedX = right - left >= 24 ? (left + right) / 2 : null;
    if (to.y >= from.y + from.h) {
        return {
            start: { x: sharedX ?? fromCenter.x, y: from.y + from.h + 6 },
            end: { x: sharedX ?? toCenter.x, y: to.y - 8 },
        };
    }
    if (to.y + to.h <= from.y) {
        return {
            start: { x: sharedX ?? fromCenter.x, y: from.y - 6 },
            end: { x: sharedX ?? toCenter.x, y: to.y + to.h + 8 },
        };
    }
    if (to.x >= from.x + from.w) {
        return { start: { x: from.x + from.w + 4, y: fromCenter.y }, end: { x: to.x - 6, y: toCenter.y } };
    }
    return { start: { x: from.x - 4, y: fromCenter.y }, end: { x: to.x + to.w + 6, y: toCenter.y } };
}
function ArrowView({ item, idPrefix }) {
    const { start, end } = arrowEnds(item.from, item.to);
    const p = item.progress;
    const marker = `${idPrefix}-arrowhead-${item.tone ?? "ink"}`;
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return (_jsxs("g", { className: `wb-item wb-arrow ${toneClass(item.tone)}`, opacity: item.opacity, children: [_jsx("path", { d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, pathLength: 1, strokeDasharray: "1", strokeDashoffset: 1 - p, markerEnd: p >= 0.95 ? `url(#${marker})` : undefined }), item.op.label && p >= 0.6 ? (_jsx("text", { className: "wb-arrow-label", x: mid.x + 10, y: mid.y, fontSize: FONT_SIZE.s, dominantBaseline: "central", children: item.op.label })) : null] }));
}
function NoteView({ item, idPrefix }) {
    const { box, target } = item;
    const lineHeight = Math.ceil(LAYOUT.noteFont * LINE_HEIGHT);
    const clip = `${idPrefix}-clip-${safeId(item.key)}`;
    const leaderStart = { x: target.x + target.w + 6, y: target.y + target.h / 2 };
    const leaderEnd = { x: box.x - 6, y: box.y + box.h / 2 };
    return (_jsxs("g", { className: `wb-item wb-note ${toneClass(item.tone)}`, opacity: item.opacity, children: [_jsx("path", { className: "wb-note-leader", d: `M ${leaderStart.x} ${leaderStart.y} L ${leaderEnd.x} ${leaderEnd.y}` }), _jsx(Reveal, { id: clip, box: box, progress: item.progress, children: _jsx("text", { className: "wb-note-text", x: box.x, y: box.y, fontSize: LAYOUT.noteFont, children: box.lines.map((line, index) => (_jsx("tspan", { x: box.x, dy: index === 0 ? lineHeight * 0.8 : lineHeight, children: line }, index))) }) })] }));
}
/** 能级图里每条能级的纵向位置：能量越高越靠上；全一样时放中间。 */
export function levelYs(energies, top, bottom) {
    const min = Math.min(...energies);
    const max = Math.max(...energies);
    if (max - min < 1e-12)
        return energies.map(() => (top + bottom) / 2);
    return energies.map((energy) => bottom - ((energy - min) / (max - min)) * (bottom - top));
}
function Electron({ x, y, up }) {
    const half = 11;
    const d = up
        ? `M ${x} ${y + half} L ${x} ${y - half} M ${x - 4} ${y - half + 6} L ${x} ${y - half} L ${x + 4} ${y - half + 6}`
        : `M ${x} ${y - half} L ${x} ${y + half} M ${x - 4} ${y + half - 6} L ${x} ${y + half} L ${x + 4} ${y + half - 6}`;
    return _jsx("path", { className: "wb-electron", d: d });
}
function LevelsView({ item }) {
    const { box, op } = item;
    const axisX = box.x + 28;
    const lineStart = box.x + 56;
    const lineEnd = box.x + 150;
    const top = box.y + 36;
    const bottom = box.y + box.h - 20;
    const ys = levelYs(op.levels.map((level) => level.energy), top, bottom);
    // 从下往上一条条出来。
    const order = op.levels.map((_, index) => index).sort((a, b) => ys[b] - ys[a]);
    const shown = new Set(order.slice(0, Math.ceil(item.progress * op.levels.length)));
    return (_jsxs("g", { className: "wb-item wb-levels", "data-wb-id": op.id, opacity: item.opacity, children: [_jsx("path", { className: "wb-levels-axis", d: `M ${axisX} ${bottom + 8} L ${axisX} ${box.y + 14}` }), _jsx("path", { className: "wb-levels-axis", d: `M ${axisX - 4} ${box.y + 20} L ${axisX} ${box.y + 14} L ${axisX + 4} ${box.y + 20}` }), op.axis ? (_jsx("text", { className: "wb-levels-caption", x: axisX + 8, y: box.y + 16, fontSize: FONT_SIZE.s - 2, children: op.axis })) : null, op.levels.map((level, index) => (shown.has(index) ? (_jsxs("g", { className: "wb-level", children: [_jsx("path", { className: "wb-level-line", d: `M ${lineStart} ${ys[index]} L ${lineEnd} ${ys[index]}` }), _jsx("text", { className: "wb-level-label", x: lineEnd + 10, y: ys[index], fontSize: FONT_SIZE.s, dominantBaseline: "central", children: level.label }), (level.electrons ?? 0) >= 1 ? _jsx(Electron, { x: (lineStart + lineEnd) / 2 - 9, y: ys[index] - 12, up: true }) : null, (level.electrons ?? 0) >= 2 ? _jsx(Electron, { x: (lineStart + lineEnd) / 2 + 9, y: ys[index] - 12, up: false }) : null] }, index)) : null))] }));
}
function ItemView({ item, math, idPrefix }) {
    switch (item.kind) {
        case "write":
            return _jsx(WriteView, { item: item, math: math, idPrefix: idPrefix });
        case "mark":
            return _jsx(MarkView, { item: item });
        case "arrow":
            return _jsx(ArrowView, { item: item, idPrefix: idPrefix });
        case "note":
            return _jsx(NoteView, { item: item, idPrefix: idPrefix });
        case "levels":
            return _jsx(LevelsView, { item: item });
    }
}
const TONES = ["ink", "focus", "correct", "wrong"];
const MAX_SCALE = 1.25;
const MIN_SCALE = 0.7;
export function BoardSvg({ frame, math, idPrefix, title }) {
    const { camera } = frame;
    // 高亮垫在字下面，其余按出现顺序画。
    const highlights = frame.items.filter((item) => item.kind === "mark" && (item.op.style ?? "box") === "highlight");
    const rest = frame.items.filter((item) => !highlights.includes(item));
    return (_jsxs("svg", { className: "wb-board", viewBox: `${camera.x} ${camera.y} ${camera.w} ${camera.h}`, preserveAspectRatio: "xMidYMin meet", 
        // 内容少时别放得太大（最多 1.25 倍）；窄屏上也别缩得太小（最少 0.7 倍，再窄就在板子里横向滚）。
        style: { maxWidth: `${Math.round(camera.w * MAX_SCALE)}px`, minWidth: `${Math.round(camera.w * MIN_SCALE)}px` }, role: "img", "aria-label": title ? `白板：${title}` : "白板", children: [_jsx("defs", { children: TONES.map((tone) => (_jsx("marker", { id: `${idPrefix}-arrowhead-${tone}`, className: `wb-arrowhead wb-tone-${tone}`, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "8", markerHeight: "8", orient: "auto-start-reverse", children: _jsx("path", { d: "M 0 0 L 10 5 L 0 10 z" }) }, tone))) }), highlights.map((item) => _jsx(ItemView, { item: item, math: math, idPrefix: idPrefix }, item.key)), rest.map((item) => _jsx(ItemView, { item: item, math: math, idPrefix: idPrefix }, item.key))] }));
}
