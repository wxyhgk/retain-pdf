// 自动排版：位置对整份脚本一次算定，播到哪一步都不挪（不会因为后面加了东西把前面的挤走）。
//
// - write / levels 默认接着往下排成一列；below 放在某个东西正下方，right_of 放在右边并垂直居中。
// - 批注放在目标右边，不占列里的位置。
// - 公式的尺寸由调用方给（mathSize），文字按字符估宽；所以这一步是纯函数。
import { FONT_SIZE, LINE_HEIGHT, textWidth, wrapText } from "./measure.js";
export const LAYOUT = {
    margin: 40,
    gapY: 18,
    /** 有箭头从上面指过来的东西，和上面隔开这么多（放得下箭头和标签）。 */
    arrowGapY: 64,
    gapX: 32,
    noteGap: 28,
    noteFont: FONT_SIZE.s,
    noteMaxWidth: 280,
    levels: { w: 240, h: 260 },
};
export function opKey(stepIndex, opIndex) {
    return `${stepIndex}:${opIndex}`;
}
export function writeSize(op, mathSize) {
    const size = op.size ?? "m";
    if (op.math !== undefined) {
        const measured = mathSize(op.math, size);
        return { w: Math.max(8, Math.ceil(measured.w)), h: Math.max(FONT_SIZE[size] * LINE_HEIGHT, Math.ceil(measured.h)) };
    }
    const fontSize = FONT_SIZE[size];
    return { w: Math.max(8, textWidth(op.text ?? "", fontSize)), h: Math.ceil(fontSize * LINE_HEIGHT) };
}
function placedSize(op, mathSize) {
    if (op.op === "levels")
        return levelsSize(op);
    return writeSize(op, mathSize);
}
/** 能级图：线段区 160px + 标签（右边）；高度固定。标签宽度按字符估。 */
export function levelsSize(op) {
    const label = Math.max(0, ...op.levels.map((level) => textWidth(level.label, FONT_SIZE.s)));
    const caption = op.axis ? textWidth(op.axis, FONT_SIZE.s - 2) + 36 : 0;
    return { w: Math.max(LAYOUT.levels.w, 160 + label + 8, caption), h: LAYOUT.levels.h };
}
export function noteLayout(op, target) {
    const lines = wrapText(op.text, LAYOUT.noteFont, LAYOUT.noteMaxWidth);
    const lineHeight = Math.ceil(LAYOUT.noteFont * LINE_HEIGHT);
    const w = Math.max(...lines.map((line) => textWidth(line, LAYOUT.noteFont)), 8);
    const h = lines.length * lineHeight;
    return {
        x: target.x + target.w + LAYOUT.noteGap,
        y: Math.round(target.y + target.h / 2 - h / 2),
        w,
        h,
        lines,
    };
}
export function layoutScript(script, mathSize) {
    const boxes = new Map();
    const notes = new Map();
    /** 还在板上的、占列的东西：新东西默认排在它们最下边的下面。 */
    const alive = new Set();
    // 先看一遍：哪些东西会有箭头指过来（箭头画在后面，位置在这里就要留出来）。
    const arrowTargets = new Set();
    for (const step of script.steps) {
        for (const op of step.ops)
            if (op.op === "arrow")
                arrowTargets.add(op.to);
    }
    const gapFor = (id) => (arrowTargets.has(id) ? LAYOUT.arrowGapY : LAYOUT.gapY);
    const columnBottom = () => {
        let bottom = -Infinity;
        for (const id of alive) {
            const box = boxes.get(id);
            if (box)
                bottom = Math.max(bottom, box.y + box.h);
        }
        return bottom;
    };
    script.steps.forEach((step, stepIndex) => {
        step.ops.forEach((op, opIndex) => {
            if (op.op === "write" || op.op === "levels") {
                const { w, h } = placedSize(op, mathSize);
                let x = LAYOUT.margin;
                let y;
                const anchor = op.below ? boxes.get(op.below) : op.right_of ? boxes.get(op.right_of) : undefined;
                if (anchor && op.below) {
                    x = anchor.x;
                    y = anchor.y + anchor.h + gapFor(op.id);
                }
                else if (anchor && op.right_of) {
                    x = anchor.x + anchor.w + LAYOUT.gapX;
                    y = Math.round(anchor.y + anchor.h / 2 - h / 2);
                }
                else {
                    const bottom = columnBottom();
                    y = bottom === -Infinity ? LAYOUT.margin : bottom + gapFor(op.id);
                }
                boxes.set(op.id, { x, y, w, h });
                alive.add(op.id);
            }
            else if (op.op === "note") {
                const target = boxes.get(op.target);
                if (target)
                    notes.set(opKey(stepIndex, opIndex), noteLayout(op, target));
            }
            else if (op.op === "erase") {
                alive.delete(op.target);
            }
        });
    });
    return { boxes, notes };
}
export function unionBox(boxes) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const box of boxes) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.w);
        maxY = Math.max(maxY, box.y + box.h);
    }
    if (minX === Infinity)
        return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
