// 在白板文字里打公式时按键怎么办（只算「改哪儿、光标去哪」，不碰界面，好测）：
//
// - 打 `$`：外面 → `$|$`（自带收尾）；选着字 → 用 `$` 包起来；在空的 `$|$` 里再打一个 → 变成单独一块的 `$$`；
//   光标正好在收尾的 `$` 前 → 跳过它。
// - 公式里：`{` 自带 `}`、`}` 跳过已有的、空 `{}` 里退格两个一起删、Tab 跳进下一个 `{}`，没有就跳出公式。
// 公式里的这几样用的是 latex-assist（搬自 notes-studio）。
import { deleteBracePair, nextSlot, typeBrace } from "../math/latex-assist.js";
import { mathAtCaret } from "../markdown/math-markdown.js";
function shift(edit, offset) {
    return { from: edit.from + offset, to: edit.to + offset, insert: edit.insert, caret: edit.caret + offset };
}
export function applyTextEdit(text, edit) {
    return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}
/** 打 `$`。返回 null 表示照常打一个 `$`。 */
export function planDollar(text, start, end) {
    if (start !== end) {
        const inside = text.slice(start, end);
        return { from: start, to: end, insert: `$${inside}$`, caret: end + 2 };
    }
    // 空的 `$|$` 里再打一个：变成单独一块。
    if (text[start - 1] === "$" && text[start] === "$" && text[start - 2] !== "$" && text[start + 1] !== "$") {
        return { from: start - 1, to: start + 1, insert: "$$\n\n$$", caret: start - 1 + 3 };
    }
    const math = mathAtCaret(text, start);
    if (math) {
        // 收尾的 `$` 就在光标后面：跳过它。
        if (!math.display && math.to > math.innerTo && start === math.innerTo)
            return { from: start, to: start, insert: "", caret: start + 1 };
        return null;
    }
    return { from: start, to: start, insert: "$$", caret: start + 1 };
}
function insideMath(text, start, end) {
    const math = mathAtCaret(text, start);
    return math && end <= math.innerTo ? math : null;
}
/** 公式里打 `{` 或 `}`。不在公式里、或者照常打时返回 null。 */
export function planBrace(text, start, end, brace) {
    const math = insideMath(text, start, end);
    if (!math)
        return null;
    const edit = typeBrace(math.tex, start - math.innerFrom, end - math.innerFrom, brace);
    return edit ? shift(edit, math.innerFrom) : null;
}
/** 公式里在空的 `{}` 中间退格：两个一起删。 */
export function planBackspace(text, start, end) {
    const math = insideMath(text, start, end);
    if (!math)
        return null;
    const edit = deleteBracePair(math.tex, start - math.innerFrom, end - math.innerFrom);
    return edit ? shift(edit, math.innerFrom) : null;
}
/** 光标所在的那一层 `{…}` 的收尾 `}` 在哪（不在任何 `{}` 里返回 null）。 */
function enclosingClose(tex, caret) {
    let depth = 0;
    for (let index = caret; index < tex.length; index += 1) {
        if (tex[index] === "\\")
            index += 1;
        else if (tex[index] === "{")
            depth += 1;
        else if (tex[index] === "}") {
            if (depth === 0)
                return index;
            depth -= 1;
        }
    }
    return null;
}
/**
 * 公式里按 Tab：跳进后面下一个 `{}`（`\frac{1|}{}` → `\frac{1}{|}`）；后面没有空了，就跳出光标所在的这一层 `{}`（`\sum_{b|}` → `\sum_{b}|`，还在公式里）；
 * 不在任何 `{}` 里时才跳到公式后面。不在公式里返回 null（照常）。
 */
export function planTab(text, caret) {
    const math = mathAtCaret(text, caret);
    if (!math)
        return null;
    const offset = caret - math.innerFrom;
    const slot = nextSlot(math.tex, offset);
    const close = enclosingClose(math.tex, offset);
    let target;
    if (slot !== null)
        target = math.innerFrom + slot;
    else if (close !== null)
        target = math.innerFrom + close + 1;
    else
        target = math.to;
    return { from: caret, to: caret, insert: "", caret: target };
}
