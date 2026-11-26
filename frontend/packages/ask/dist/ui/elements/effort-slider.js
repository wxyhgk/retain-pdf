import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 思考强度的胶囊滑块：改自 zanwei/claude-model-selector（MIT，Copyright (c) 2026 Zanwei Guo，
 * https://github.com/zanwei/claude-model-selector ，仿 Claude 桌面版的 Effort 滑块）。
 *
 * 照搬的：轨道 + 刻度 + 滑块的样子；拖的时候靠近刻度被吸过去（_applyMagnet）；松手按拖动速度弹到最近一档（_springTo，
 * 刚度 920、阻尼 40）；档位名切换时上下错开淡入淡出；方向键 / Home / End / PageUp / PageDown；系统要求减少动画时不弹、不淡。
 * 改了的：原作是 Web Component、写死六档（Low…Ultracode）和紫色；这里是 React，档位由调用方给（agent 报几档就几档、名字照原样），
 * 颜色由调用方按档位算（colorAt），不再有最高档的像素动画、帮助气泡和自己的弹层（放在选模型的弹层里）。样式在 styles/ask.css。
 */
import { useEffect, useRef, useState } from "react";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
/** 离刻度不到半档时往刻度吸，越近吸得越狠（原作的 _applyMagnet）。 */
function magnet(value) {
    const nearest = Math.round(value);
    const delta = value - nearest;
    const distance = Math.abs(delta);
    if (distance < 0.001 || distance > 0.5)
        return value;
    const t = 1 - distance / 0.5;
    return value - delta * (0.68 + 0.42 * t) * t * t;
}
function reducedMotion() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
const KEY_STEP = { ArrowLeft: -1, ArrowDown: -1, PageDown: -1, ArrowRight: 1, ArrowUp: 1, PageUp: 1 };
export function EffortSlider({ levels, value, onChange, colorAt, label, start, end, className, ...rest }) {
    const count = levels.length;
    const max = Math.max(0, count - 1);
    const settled = Math.max(0, levels.findIndex((level) => level.id === value));
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const position = useRef(settled);
    const dragging = useRef(false);
    const samples = useRef([]);
    const frame = useRef(0);
    // 显示的那档（拖的时候跟着变）和刚换下去的那档（做淡出）；serial 让换档的动画每次都重播。
    const [shown, setShown] = useState({ index: settled, previous: -1, forward: true, serial: 0 });
    const paint = (next) => {
        position.current = clamp(next, 0, max);
        if (inputRef.current)
            inputRef.current.value = String(position.current);
        rootRef.current?.style.setProperty("--effort-progress", String(max ? position.current / max : 0));
        const index = Math.round(position.current);
        setShown((old) => (old.index === index ? old : { index, previous: old.index, forward: index > old.index, serial: old.serial + 1 }));
    };
    const commit = (index) => {
        paint(index);
        if (levels[index] && levels[index].id !== value)
            onChange(levels[index].id);
    };
    // 外面改了档位（agent 推来的、换了 agent）：没在拖、没在弹，就直接跳过去。
    useEffect(() => {
        if (!dragging.current && !frame.current)
            paint(settled);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settled, max]);
    useEffect(() => () => cancelAnimationFrame(frame.current), []);
    /** 松手：按最后 90ms 的拖动速度给初速度，弹簧弹到最近一档，停稳了才算选上。 */
    const snap = () => {
        const target = Math.round(position.current);
        if (reducedMotion() || Math.abs(target - position.current) < 0.001)
            return commit(target);
        let velocity = 0;
        const list = samples.current;
        if (list.length >= 2) {
            const first = list[0];
            const last = list[list.length - 1];
            velocity = clamp((last.value - first.value) / Math.max((last.time - first.time) / 1000, 0.016), -8, 8);
        }
        let at = position.current;
        let previousTime = performance.now();
        const step = (time) => {
            const delta = Math.min((time - previousTime) / 1000, 0.032);
            previousTime = time;
            velocity += (-920 * (at - target) - 40 * velocity) * delta;
            at = clamp(at + velocity * delta, 0, max);
            paint(at);
            if (Math.abs(at - target) < 0.001 && Math.abs(velocity) < 0.01) {
                frame.current = 0;
                commit(target);
                return;
            }
            frame.current = requestAnimationFrame(step);
        };
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(step);
    };
    const onKeyDown = (event) => {
        const target = event.key === "Home" ? 0 : event.key === "End" ? max : event.key in KEY_STEP ? shown.index + KEY_STEP[event.key] : null;
        // 弹层里的模型列表（cmdk）也听方向键：这里用掉了就不往上传。
        event.stopPropagation();
        if (target === null)
            return;
        event.preventDefault();
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        commit(clamp(target, 0, max));
    };
    if (count < 2)
        return null;
    const current = levels[shown.index];
    const previous = shown.previous >= 0 && shown.previous !== shown.index ? levels[shown.previous] : undefined;
    const style = {
        "--effort-progress": String(max ? position.current / max : 0),
        "--effort-color": colorAt ? colorAt(shown.index, count) : "currentColor",
        "--effort-top-color": colorAt ? colorAt(max, count) : "currentColor",
    };
    return (_jsxs("div", { ref: rootRef, "data-slot": "effort-slider", className: ["aui-effort-slider", className].filter(Boolean).join(" "), style: style, title: current?.description || undefined, children: [_jsxs("div", { className: "aui-effort-slider-head", children: [label, _jsxs("span", { className: "aui-effort-slider-stage", "aria-live": "polite", "aria-atomic": "true", children: [previous ? _jsx("span", { className: "aui-effort-slider-out", "data-forward": shown.forward, "aria-hidden": true, children: previous.name }, `out-${shown.serial}`) : null, _jsx("span", { className: "aui-effort-slider-in", "data-forward": shown.forward, "data-animate": shown.serial > 0, children: current?.name }, `in-${shown.serial}`)] })] }), start || end ? (_jsxs("div", { className: "aui-effort-slider-axis", "aria-hidden": true, children: [_jsx("span", { children: start }), _jsx("span", { children: end })] })) : null, _jsxs("div", { className: "aui-effort-slider-track-shell", children: [_jsxs("div", { className: "aui-effort-slider-track", "aria-hidden": true, children: [_jsx("div", { className: "aui-effort-slider-fill" }), _jsx("div", { className: "aui-effort-slider-ticks", children: levels.map((level, index) => _jsx("span", { "data-passed": index <= shown.index }, level.id)) })] }), _jsx("input", { ref: inputRef, className: "aui-effort-slider-range", type: "range", min: 0, max: max, step: 0.001, defaultValue: settled, "aria-label": rest["aria-label"] || "思考强度", "aria-valuetext": current?.name, onPointerDown: () => {
                            cancelAnimationFrame(frame.current);
                            frame.current = 0;
                            dragging.current = true;
                            samples.current = [{ time: performance.now(), value: position.current }];
                            // 拖出滑块外再松手也要收尾：松手事件挂在 window 上。
                            const end = () => {
                                window.removeEventListener("pointerup", end);
                                window.removeEventListener("pointercancel", end);
                                if (!dragging.current)
                                    return;
                                dragging.current = false;
                                snap();
                            };
                            window.addEventListener("pointerup", end);
                            window.addEventListener("pointercancel", end);
                        }, onChange: (event) => {
                            let next = Number.parseFloat(event.currentTarget.value);
                            if (!Number.isFinite(next))
                                return;
                            if (dragging.current) {
                                next = magnet(next);
                                const now = performance.now();
                                samples.current = [...samples.current, { time: now, value: next }].filter((sample) => now - sample.time < 90).slice(-5);
                                paint(next);
                            }
                            else {
                                // 不是拖（点轨道、读屏软件调）：直接到最近一档。
                                commit(Math.round(next));
                            }
                        }, onKeyDown: onKeyDown })] })] }));
}
