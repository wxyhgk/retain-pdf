import { type FontSizeKey, type RenderedMath } from "../layout/measure.js";
export type WhiteboardMathEngine = {
    /** 返回 MathJax 的 <svg>…</svg> 字符串（尺寸单位 ex）。写错时抛错或返回带 data-mjx-error 的 SVG。
     * display 默认 true（行间公式）；行内公式传 false。 */
    toSvg(tex: string, display?: boolean): string;
};
export type WhiteboardMathEngineLoader = () => Promise<WhiteboardMathEngine>;
export declare function setWhiteboardMathEngine(loader: WhiteboardMathEngineLoader | null): void;
/** 先把公式引擎加载好（之后 mathHtmlNow 能同步排）。 */
export declare function loadMathEngine(): Promise<void>;
export declare function mathEngineReady(): boolean;
/** 排在 HTML 文字里的一段公式：保留 MathJax 的 ex 单位（跟着字号走）和基线对齐。 */
export type MathHtml = {
    html: string;
    error?: undefined;
} | {
    html?: undefined;
    error: string;
};
/**
 * 同步把一段 TeX 排成可以放进 HTML 的 SVG（白板上的文字、边打边看的预览）。
 * 引擎还没加载时返回 null（调用方先 loadMathEngine）；写错时返回 error（MathJax 的说明）。
 */
export declare function mathHtmlNow(tex: string, display: boolean): MathHtml | null;
/**
 * 脚本是模型写的：就算 TeX 里写了 \href 之类，排出来的 SVG 里也不留链接、事件属性和外部引用，
 * 只留页内的 #引用。
 */
export declare function sanitizeMathSvg(svg: string): string;
/** 把 MathJax 的 SVG 改成像素尺寸，嵌进白板的 <svg> 里直接用。 */
export declare function sizeMathSvg(svg: string, size: FontSizeKey): RenderedMath;
/** 已经排好的公式（同步取，排版和渲染都用它）。没排过返回 null。 */
export declare function cachedMath(tex: string, size: FontSizeKey): RenderedMath | null;
/** 把一批公式先排好放进缓存；写错的公式记成错误，不抛。 */
export declare function prepareMath(items: ReadonlyArray<{
    tex: string;
    size: FontSizeKey;
}>): Promise<void>;
