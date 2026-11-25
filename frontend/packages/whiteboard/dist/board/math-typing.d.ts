import { type LatexEdit } from "../math/latex-assist.js";
/** 对整段文字的一次修改：把 [from, to) 换成 insert，光标放到 caret。 */
export type TextEdit = LatexEdit;
export declare function applyTextEdit(text: string, edit: TextEdit): string;
/** 打 `$`。返回 null 表示照常打一个 `$`。 */
export declare function planDollar(text: string, start: number, end: number): TextEdit | null;
/** 公式里打 `{` 或 `}`。不在公式里、或者照常打时返回 null。 */
export declare function planBrace(text: string, start: number, end: number, brace: "{" | "}"): TextEdit | null;
/** 公式里在空的 `{}` 中间退格：两个一起删。 */
export declare function planBackspace(text: string, start: number, end: number): TextEdit | null;
/**
 * 公式里按 Tab：跳进后面下一个 `{}`（`\frac{1|}{}` → `\frac{1}{|}`）；后面没有空了，就跳出光标所在的这一层 `{}`（`\sum_{b|}` → `\sum_{b}|`，还在公式里）；
 * 不在任何 `{}` 里时才跳到公式后面。不在公式里返回 null（照常）。
 */
export declare function planTab(text: string, caret: number): TextEdit | null;
