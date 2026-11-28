/**
 * 把 PDF 文字层选出来的一段字收拾好：
 * - 行尾断词的连字符接回去（"compu-\ntation" → "computation"，只在连字符前是字母、下一行小写开头时；大写开头的留着连字符）；
 * - 其余的换行接成一个空格，中日韩字两边不加空格；空一行的地方（段落）留一个换行；
 * - 去掉软连字符；数学字母、连字还原成普通字母；「̸ ⊆」这种拆开的否定号合回「⊈」；
 * - 连着的空白收成一个，头尾去掉。
 */
export declare function cleanPdfSelectionText(raw: string): string;
export declare function hasMathChar(text: string): boolean;
/** 夹在公式中间也算公式的短段：空白、短的大写缩写 / 数字 / 括号；有成词的小写（≥ 3 个小写字母）就是正文。 */
export declare function isFormulaFiller(text: string): boolean;
export type FormulaToken = {
    text: string;
    line: number;
};
/**
 * 第 index 段所在的公式串 [start, end]（含两头）；它不在公式里是 null。
 * tokens 是文字层里按顺序的一段段字和它们在第几行（同一行的段落 line 相同）。
 * 串两头的空白段不算进去。
 */
export declare function formulaRunAt(tokens: readonly FormulaToken[], index: number): [number, number] | null;
export type SelectionRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
/**
 * 把一个个字的框收成每行一条色带：上下有一半以上重叠的算同一行；同一行里隔得太远（> 两个行高，双栏的栏缝）分开画。
 * 行高按这一行里够高的框（≥ 最高的 75%，上下标那种小框不算）定，色带上下一样齐。
 */
export declare function mergeSelectionRects(rects: readonly SelectionRect[]): SelectionRect[];
//# sourceMappingURL=selection-text.d.ts.map