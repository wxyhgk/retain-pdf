// 某一步、这一步过了多少毫秒时，板上画着什么。纯函数：不看时钟、不用随机数，
// 同样的输入永远得到同样的一帧 —— 截图测试靠它，以后短剧逐帧导出也靠它。
//
// 规则：
// - 一步里的指令按顺序一个接一个动画，前一条画完才开始下一条。
// - 前面各步的东西都画完了留着；被 erase 的东西（连同指着它的箭头、批注）在擦的那一步淡出，之后消失。
// - mark 只在它那一步里显示（指一下、圈一下），下一步就不在了；箭头和批注一直留着。
// - 镜头：每一步开头从上一步结束时的范围移到这一步结束时的范围；focus 把镜头推到目标上，直到这一步结束。
import { opKey, unionBox } from "../layout/layout.js";
export const TIMING = {
    camera: 450,
    mark: 450,
    arrow: 500,
    erase: 350,
    focus: 600,
    levels: 900,
};
const CAMERA_PAD = 32;
const FOCUS_PAD = 48;
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function opDuration(op) {
    switch (op.op) {
        case "write":
            return op.math !== undefined
                ? clamp(op.math.length * 25, 450, 1400)
                : clamp((op.text ?? "").length * 35, 350, 1400);
        case "note":
            return clamp(op.text.length * 30, 350, 1100);
        case "mark":
            return TIMING.mark;
        case "arrow":
            return TIMING.arrow;
        case "erase":
            return TIMING.erase;
        case "focus":
            return TIMING.focus;
        case "levels":
            return TIMING.levels;
        default:
            return 0;
    }
}
export function stepTimeline(ops) {
    const starts = [];
    const durations = [];
    let cursor = 0;
    for (const op of ops) {
        starts.push(cursor);
        const duration = opDuration(op);
        durations.push(duration);
        cursor += duration;
    }
    return { starts, durations, total: Math.max(cursor, TIMING.camera) };
}
/** 缓动：先快后慢，像手写收笔。 */
export function easeOut(t) {
    const x = clamp(t, 0, 1);
    return 1 - (1 - x) ** 3;
}
function refsOf(op) {
    switch (op.op) {
        case "write":
        case "levels":
            return [op.id];
        case "mark":
        case "note":
            return [op.target];
        case "arrow":
            return [op.from, op.to];
        default:
            return [];
    }
}
/** 第 stepIndex 步全部画完时板上留着的东西的范围（不含 mark 的外扩，够用）。 */
function settledBounds(script, layout, stepIndex) {
    const live = new Set();
    const notes = [];
    const noteRefs = [];
    for (let s = 0; s <= stepIndex && s < script.steps.length; s += 1) {
        script.steps[s].ops.forEach((op, o) => {
            if (op.op === "write" || op.op === "levels")
                live.add(op.id);
            else if (op.op === "erase")
                live.delete(op.target);
            else if (op.op === "note") {
                const note = layout.notes.get(opKey(s, o));
                if (note)
                    noteRefs.push({ target: op.target, box: note });
            }
        });
    }
    for (const { target, box } of noteRefs)
        if (live.has(target))
            notes.push(box);
    const boxes = [...live].map((id) => layout.boxes.get(id)).filter((box) => Boolean(box));
    return unionBox([...boxes, ...notes]);
}
function pad(box, amount) {
    return { x: box.x - amount, y: box.y - amount, w: box.w + amount * 2, h: box.h + amount * 2 };
}
function lerpBox(a, b, t) {
    const k = easeOut(t);
    return {
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        w: a.w + (b.w - a.w) * k,
        h: a.h + (b.h - a.h) * k,
    };
}
const EMPTY_CAMERA = { x: 0, y: 0, w: 640, h: 360 };
function baseCamera(script, layout, stepIndex) {
    for (let s = stepIndex; s >= 0; s -= 1) {
        const bounds = settledBounds(script, layout, s);
        if (bounds)
            return pad(bounds, CAMERA_PAD);
    }
    const first = script.steps.length ? settledBounds(script, layout, 0) : null;
    return first ? pad(first, CAMERA_PAD) : EMPTY_CAMERA;
}
function lastFocus(script, layout, stepIndex) {
    const step = script.steps[stepIndex];
    if (!step)
        return null;
    for (let o = step.ops.length - 1; o >= 0; o -= 1) {
        const op = step.ops[o];
        if (op.op === "focus") {
            const box = layout.boxes.get(op.target);
            if (box)
                return pad(box, FOCUS_PAD);
        }
    }
    return null;
}
/** 第 stepIndex 步结束时镜头停在哪。 */
function endCamera(script, layout, stepIndex) {
    if (stepIndex < 0)
        return baseCamera(script, layout, 0);
    return lastFocus(script, layout, stepIndex) ?? baseCamera(script, layout, stepIndex);
}
export function frameAt(script, layout, stepIndex, elapsedMs) {
    const stepCount = script.steps.length;
    const current = clamp(Math.floor(stepIndex), 0, Math.max(0, stepCount - 1));
    const t = Math.max(0, elapsedMs);
    const entries = new Map();
    const warnings = [];
    let camera = endCamera(script, layout, current - 1);
    const cameraTarget = baseCamera(script, layout, current);
    camera = lerpBox(camera, cameraTarget, t / TIMING.camera);
    let stepDuration = 0;
    for (let s = 0; s <= current && s < stepCount; s += 1) {
        const step = script.steps[s];
        const timeline = stepTimeline(step.ops);
        const isCurrent = s === current;
        if (isCurrent)
            stepDuration = timeline.total;
        step.ops.forEach((op, o) => {
            const progress = isCurrent ? clamp((t - timeline.starts[o]) / (timeline.durations[o] || 1), 0, 1) : 1;
            const started = !isCurrent || t >= timeline.starts[o];
            if (op.op === "unknown") {
                if (isCurrent)
                    warnings.push(op.reason);
                return;
            }
            if (!started)
                return;
            if (op.op === "erase") {
                for (const [key, entry] of entries) {
                    if (entry.refs.includes(op.target)) {
                        if (progress >= 1 && !isCurrent)
                            entries.delete(key);
                        else
                            entry.opacity = Math.min(entry.opacity, 1 - progress);
                    }
                }
                return;
            }
            if (op.op === "focus") {
                const box = layout.boxes.get(op.target);
                if (isCurrent && box)
                    camera = lerpBox(camera, pad(box, FOCUS_PAD), progress);
                return;
            }
            const key = op.op === "write" || op.op === "levels" ? `obj:${op.id}` : `${op.op}:${s}:${o}`;
            entries.set(key, {
                key,
                kind: op.op,
                op,
                refs: refsOf(op),
                stepIndex: s,
                progress,
                opacity: 1,
                ...(op.op === "note" ? { note: layout.notes.get(opKey(s, o)) } : {}),
            });
        });
    }
    const items = [];
    for (const entry of entries.values()) {
        if (entry.kind === "mark" && entry.stepIndex !== current)
            continue;
        const base = { key: entry.key, progress: entry.progress, opacity: entry.opacity };
        if (entry.kind === "write" || entry.kind === "levels") {
            const box = layout.boxes.get(entry.op.id);
            if (!box)
                continue;
            items.push(entry.kind === "write"
                ? { ...base, kind: "write", op: entry.op, box }
                : { ...base, kind: "levels", op: entry.op, box });
        }
        else if (entry.kind === "mark") {
            const op = entry.op;
            const box = layout.boxes.get(op.target);
            if (box)
                items.push({ ...base, kind: "mark", op, box, tone: op.tone ?? "focus" });
        }
        else if (entry.kind === "arrow") {
            const op = entry.op;
            const from = layout.boxes.get(op.from);
            const to = layout.boxes.get(op.to);
            if (from && to)
                items.push({ ...base, kind: "arrow", op, from, to, ...(op.tone ? { tone: op.tone } : {}) });
        }
        else if (entry.kind === "note") {
            const op = entry.op;
            const target = layout.boxes.get(op.target);
            if (target && entry.note)
                items.push({ ...base, kind: "note", op, box: entry.note, target, ...(op.tone ? { tone: op.tone } : {}) });
        }
    }
    return {
        stepIndex: current,
        stepCount,
        say: script.steps[current]?.say ?? "",
        items,
        camera,
        stepDone: t >= stepDuration,
        stepDuration,
        warnings,
    };
}
