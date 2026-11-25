import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 白板组件：收一份讲解脚本（模型给的 JSON，组件里先校验），一步一步播。
//
// 对外：<Whiteboard script={…} />；要自己管第几步就传 step + onStepChange。
// 键盘（板子有焦点时）：← 上一步、→ 下一步、空格 播放 / 暂停、R 重播这一步。
// 系统设了「减少动态效果」时不放动画，每一步直接显示画完的样子。
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@retainpdf/ui";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { validateScript } from "../script/validate.js";
import { layoutScript } from "../layout/layout.js";
import { textWidth, FONT_SIZE, LINE_HEIGHT } from "../layout/measure.js";
import { frameAt, stepTimeline } from "../render/frame.js";
import { cachedMath, prepareMath } from "../math/engine.js";
import { BoardSvg } from "./BoardSvg.js";
/** 自动播放时，一步画完后停多久再进下一步。 */
const AUTO_ADVANCE_HOLD_MS = 1200;
function usePrefersReducedMotion() {
    const query = typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const [reduced, setReduced] = useState(Boolean(query?.matches));
    useEffect(() => {
        if (!query)
            return undefined;
        const onChange = () => setReduced(query.matches);
        query.addEventListener?.("change", onChange);
        return () => query.removeEventListener?.("change", onChange);
    }, [query]);
    return reduced;
}
function mathItems(script) {
    const items = [];
    for (const step of script.steps) {
        for (const op of step.ops) {
            if (op.op === "write" && op.math !== undefined)
                items.push({ tex: op.math, size: op.size ?? "m" });
        }
    }
    return items;
}
export function Whiteboard({ script: rawScript, step: controlledStep, onStepChange, autoPlay = false, reducedMotion, hideControls = false, onIssues, className, }) {
    const idPrefix = `wb${useId().replace(/[^A-Za-z0-9]/g, "")}`;
    const systemReduced = usePrefersReducedMotion();
    const still = reducedMotion ?? systemReduced;
    const { script, issues } = useMemo(() => validateScript(rawScript), [rawScript]);
    useEffect(() => {
        if (issues.length)
            onIssues?.(issues);
    }, [issues, onIssues]);
    const formulas = useMemo(() => mathItems(script), [script]);
    const [mathVersion, setMathVersion] = useState(0);
    const [mathReady, setMathReady] = useState(formulas.length === 0);
    useEffect(() => {
        let cancelled = false;
        if (!formulas.length) {
            setMathReady(true);
            return undefined;
        }
        setMathReady(formulas.every(({ tex, size }) => cachedMath(tex, size)));
        prepareMath(formulas).finally(() => {
            if (cancelled)
                return;
            setMathReady(true);
            setMathVersion((version) => version + 1);
        });
        return () => {
            cancelled = true;
        };
    }, [formulas]);
    const layout = useMemo(() => layoutScript(script, (tex, size) => {
        const rendered = cachedMath(tex, size);
        if (rendered && !rendered.error)
            return rendered;
        return { w: textWidth(tex, FONT_SIZE[size]), h: FONT_SIZE[size] * LINE_HEIGHT };
    }), [script, mathVersion]);
    const stepCount = script.steps.length;
    const [ownStep, setOwnStep] = useState(0);
    const step = Math.min(Math.max(0, controlledStep ?? ownStep), Math.max(0, stepCount - 1));
    const setStep = useCallback((next) => {
        const clamped = Math.min(Math.max(0, next), Math.max(0, stepCount - 1));
        if (controlledStep === undefined)
            setOwnStep(clamped);
        onStepChange?.(clamped);
    }, [controlledStep, onStepChange, stepCount]);
    const [playing, setPlaying] = useState(autoPlay);
    const [elapsed, setElapsed] = useState(0);
    const [replayToken, setReplayToken] = useState(0);
    // 这一步画多久（逐帧刷新到它为止）。
    const durationRef = useRef(0);
    durationRef.current = stepTimeline(script.steps[step]?.ops ?? []).total;
    // 换了一步（或重播）就从 0 开始画；画完停住。
    useEffect(() => {
        if (still || !mathReady) {
            setElapsed(Number.POSITIVE_INFINITY);
            return undefined;
        }
        setElapsed(0);
        const start = performance.now();
        let id = 0;
        // 画完这一步就自己停：不要靠别的 effect 去取消它 —— 公式排得很快时（MathJax 已经加载过），
        // 「画完了就取消」的那个 effect 会和这里同一次提交里跑，把刚开始的这一轮取消掉，动画停在第 0 帧。
        const tick = (now) => {
            const elapsedMs = now - start;
            setElapsed(elapsedMs);
            if (elapsedMs <= durationRef.current)
                id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [step, replayToken, still, mathReady]);
    const frame = useMemo(() => frameAt(script, layout, step, elapsed), [script, layout, step, elapsed]);
    // 自动播放：一步画完后停一会儿进下一步。
    useEffect(() => {
        if (!frame.stepDone)
            return undefined;
        if (!playing)
            return undefined;
        if (step >= stepCount - 1) {
            setPlaying(false);
            return undefined;
        }
        const timer = setTimeout(() => setStep(step + 1), AUTO_ADVANCE_HOLD_MS);
        return () => clearTimeout(timer);
    }, [frame.stepDone, playing, step, stepCount, setStep]);
    const onKeyDown = (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey)
            return;
        if (event.key === "ArrowLeft")
            setStep(step - 1);
        else if (event.key === "ArrowRight")
            setStep(step + 1);
        else if (event.key === " ")
            setPlaying((value) => !value);
        else if (event.key === "r" || event.key === "R")
            setReplayToken((value) => value + 1);
        else
            return;
        event.preventDefault();
    };
    const math = useCallback((tex, size) => cachedMath(tex, size), [mathVersion]);
    return (_jsxs("div", { className: `wb-root${className ? ` ${className}` : ""}`, tabIndex: 0, onKeyDown: onKeyDown, "data-wb-step": step, "data-wb-done": frame.stepDone ? "true" : "false", children: [_jsxs("div", { className: "wb-stage", children: [stepCount === 0 ? (_jsx("p", { className: "wb-empty", children: "\u8FD9\u4EFD\u8BB2\u89E3\u662F\u7A7A\u7684\u3002" })) : !mathReady ? (_jsx("p", { className: "wb-empty", children: "\u6B63\u5728\u6392\u516C\u5F0F\u2026" })) : (_jsx(BoardSvg, { frame: frame, math: math, idPrefix: idPrefix, title: script.title })), frame.warnings.length ? (_jsx("ul", { className: "wb-warnings", "aria-label": "\u8FD9\u4E00\u6B65\u6709\u6CA1\u8BA4\u51FA\u6765\u7684\u6307\u4EE4", children: frame.warnings.map((warning, index) => _jsxs("li", { children: ["\u8DF3\u8FC7\u4E00\u6761\u6307\u4EE4\uFF1A", warning] }, index)) })) : null] }), frame.say ? _jsx("p", { className: "wb-say", "aria-live": "polite", children: frame.say }) : null, hideControls || stepCount === 0 ? null : (_jsxs("div", { className: "wb-controls", children: [_jsx(Button, { variant: "secondary", size: "sm", className: "wb-btn", "aria-label": "\u4E0A\u4E00\u6B65", disabled: step <= 0, onClick: () => setStep(step - 1), children: _jsx(ChevronLeft, { "aria-hidden": "true" }) }), _jsx(Button, { variant: "secondary", size: "sm", className: "wb-btn", "aria-label": playing ? "暂停" : "自动播放", "aria-pressed": playing, onClick: () => setPlaying((value) => !value), children: playing ? _jsx(Pause, { "aria-hidden": "true" }) : _jsx(Play, { "aria-hidden": "true" }) }), _jsx(Button, { variant: "secondary", size: "sm", className: "wb-btn", "aria-label": "\u4E0B\u4E00\u6B65", disabled: step >= stepCount - 1, onClick: () => setStep(step + 1), children: _jsx(ChevronRight, { "aria-hidden": "true" }) }), _jsx(Button, { variant: "secondary", size: "sm", className: "wb-btn", "aria-label": "\u91CD\u64AD\u8FD9\u4E00\u6B65", onClick: () => setReplayToken((value) => value + 1), children: _jsx(RotateCcw, { "aria-hidden": "true" }) }), _jsxs("span", { className: "wb-progress", children: [step + 1, " / ", stepCount] })] }))] }));
}
