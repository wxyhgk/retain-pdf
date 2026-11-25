export type MathSegment = {
    /** 整个公式（含定界符）在文字里的范围 [from, to)。 */
    from: number;
    to: number;
    /** 公式本身（不含定界符）在文字里的范围。 */
    innerFrom: number;
    innerTo: number;
    tex: string;
    display: boolean;
};
/**
 * 文字里所有的公式，按出现顺序。规则和常见的 Markdown 公式写法一致：
 * - `$$…$$`、`\[…\]` 是单独一块（可以跨行）；
 * - `$…$`、`\(…\)` 是行内；`$` 后面紧跟空白、或者结尾的 `$` 前面是空白 / 后面紧跟数字的不算（`$5 和 $10`）；
 * - 转义的 `\$` 不算；代码里的不算；行内公式不跨空行。
 * open 为 true 时，没写完的行内公式（只有开头的 `$`，后面没有别的 `$`）也算一个、到文字末尾为止——边打边看要用；
 * 渲染时不算（`$5 和 $10` 里的 `$10` 不是公式）。
 */
export declare function findMath(text: string, { open }?: {
    open?: boolean;
}): MathSegment[];
/** 光标所在的公式（光标在定界符里面，或者正好在公式末尾）。不在公式里返回 null。 */
export declare function mathAtCaret(text: string, caret: number): MathSegment | null;
/**
 * 整段 Markdown → HTML：先把公式换成占位符（免得 Markdown 把 `_`、`*` 当成斜体），渲染完再换回公式。
 * 公式引擎没加载好时公式按原文显示（调用方 loadMathEngine 后再渲染一次）。
 */
export declare function renderMathMarkdown(text: string): string;
