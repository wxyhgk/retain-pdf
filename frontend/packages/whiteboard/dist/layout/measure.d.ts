export declare const FONT_SIZE: {
    readonly s: 16;
    readonly m: 22;
    readonly l: 30;
};
export type FontSizeKey = keyof typeof FONT_SIZE;
export declare const LINE_HEIGHT = 1.35;
/** 一个字符大约占几个 em。中日韩和全角按 1，拉丁字母按常见无衬线字体的平均宽度。 */
export declare function charEm(char: string): number;
export declare function textWidth(value: string, fontSize: number): number;
/** 按估出来的宽度折行（批注用）；英文按词折，中文按字折。 */
export declare function wrapText(value: string, fontSize: number, maxWidth: number): string[];
export type Size = {
    w: number;
    h: number;
};
/** MathJax 排出来的一段公式：SVG 字符串和它的像素尺寸。 */
export type RenderedMath = Size & {
    svg: string;
    /** 基线到底边的距离（像素），文字和公式并排时对齐用。 */
    depth: number;
    /** TeX 写错时 MathJax 给的说明；有它时 svg 是错误提示。 */
    error?: string;
};
/** MathJax 的尺寸单位是 ex；按当前字号换成像素（1ex ≈ 0.442em，MathJax 默认字体）。 */
export declare function exToPx(ex: number, fontSize: number): number;
