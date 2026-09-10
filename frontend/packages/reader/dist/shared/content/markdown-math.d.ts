export type MarkdownMathSlot = {
    token: string;
    tex: string;
    display: boolean;
};
export type ExtractMarkdownMathResult = {
    text: string;
    slots: MarkdownMathSlot[];
};
export type MathJaxEngine = {
    convert(tex: string, display: boolean): string;
};
export type MarkdownMathEngineLoader = () => Promise<MathJaxEngine>;
/** 供单测或宿主注入自定义 MathJax 引擎（传 null 恢复默认动态 import） */
export declare function setMarkdownMathEngineLoader(loader: MarkdownMathEngineLoader | null): void;
export declare function resetMarkdownMathEngineLoader(): void;
/**
 * 抽出 LaTeX 片段并换成占位符，避免 marked 破坏下标/命令。
 * 顺序：块级 $$ / \[ \] → 行内 \( \) / $...$
 */
export declare function extractMarkdownMath(source: string): ExtractMarkdownMathResult;
export declare function renderMathFallbackHtml(tex: string, display: boolean): string;
export declare function wrapMathSvgHtml(svgHtml: string, display: boolean): string;
/** 将 HTML 中的占位符替换为 MathJax SVG（失败则回退为代码片段）。 */
export declare function materializeMarkdownMathHtml(html: string, slots: MarkdownMathSlot[]): Promise<string>;
/** Fast first paint: keep every formula visible without waiting for MathJax. */
export declare function materializeMarkdownMathFallbackHtml(html: string, slots: MarkdownMathSlot[]): string;
/** 完整管线：保护公式 → marked.parse → 还原 SVG。 */
export declare function parseMarkdownWithMath(markdown: string, parseMarkdown: (src: string) => string): Promise<string>;
//# sourceMappingURL=markdown-math.d.ts.map