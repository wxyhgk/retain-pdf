import { type FontSizeKey, type RenderedMath } from "../layout/measure.js";
export type WhiteboardMathEngine = {
    /** 返回 MathJax 的 <svg>…</svg> 字符串（尺寸单位 ex）。写错时抛错或返回带 data-mjx-error 的 SVG。 */
    toSvg(tex: string): string;
};
export type WhiteboardMathEngineLoader = () => Promise<WhiteboardMathEngine>;
export declare function setWhiteboardMathEngine(loader: WhiteboardMathEngineLoader | null): void;
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
