export type MarkdownMathSlot = {
    token: string;
    tex: string;
    display: boolean;
};
export type ExtractMarkdownMathResult = {
    text: string;
    slots: MarkdownMathSlot[];
};
export type ExtractMarkdownMathOptions = {
    /**
     * Also treat un-delimited LaTeX fragments (e.g. `^{6}`, `\mathbf{Q}`,
     * `CHCl_{3}`) as math. Off by default so plain-text/markdown callers keep
     * treating bare `^`/`_`/`\` as literal text.
     *
     * Only strong LaTeX signals qualify (a `\command`, or a braced subscript /
     * superscript like `_{...}` / `^{...}`), so code identifiers such as
     * `pdf_font`, `page_layout` or `get_imports(url)` are never turned into math.
     */
    bareLatex?: boolean;
};
export type MathJaxEngine = {
    convert(tex: string, display: boolean): string;
};
export type MarkdownMathEngineLoader = () => Promise<MathJaxEngine>;
/** 供单测或宿主注入自定义 MathJax 引擎（传 null 恢复默认动态 import） */
export declare function setMarkdownMathEngineLoader(loader: MarkdownMathEngineLoader | null): void;
export declare function resetMarkdownMathEngineLoader(): void;
/**
 * 把漏还原的保护 token 变成看得见的文本。
 *
 * `<f1-e32/>` 在 Markdown 里会被当成未知 HTML 元素——不是显示成乱码，而是**整段
 * 消失**:实测 `结果为 <f1-e32/> 所示` 渲染出来的 textContent 是 `结果为  所示`,
 * 公式连痕迹都不剩。比显示成垃圾更糟,因为没人会发现译文少了东西。
 *
 * 后端对这类 token 只在缓存读写处设了闸（坏译文不入缓存、命中即作废）,不拦投递,
 * 所以前端仍会拿到。这里只保证它可见,不试图还原——还原信息在后端。
 */
export declare function revealProtectedTokens(source: string): {
    text: string;
    count: number;
};
export declare function extractMarkdownMath(source: string, options?: ExtractMarkdownMathOptions): ExtractMarkdownMathResult;
/** 公式渲染失败的计数与最近一次原因，供控制台排查。 */
export declare const mathFailureStats: {
    engineLoad: number;
    convert: number;
    lastReason: string;
    /** 最近若干条失败的公式原文，用来判断是哪一类写法出了问题。 */
    samples: string[];
    /** 译文里漏还原的后端保护 token 数量。不是渲染失败，是上游漏了一步。 */
    protectedTokens: number;
};
/**
 * 一条公式画成 MathJax 的 SVG（和 Markdown、实时译文同一个引擎、同一套包）；画不出来是 null（失败计数照记）。
 * HTML 页照排版引擎的 layout.json 摆公式用（pdf/LayoutPageLayer.tsx，2026-11-28）。
 */
export declare function renderTexToSvg(tex: string, display: boolean): Promise<string | null>;
export declare function renderMathFallbackHtml(tex: string, display: boolean): string;
export declare function wrapMathSvgHtml(svgHtml: string, display: boolean): string;
export declare function normalizeMathTex(tex: string): string;
/** 将 HTML 中的占位符替换为 MathJax SVG（失败则回退为代码片段）。 */
export declare function materializeMarkdownMathHtml(html: string, slots: MarkdownMathSlot[]): Promise<string>;
/** Fast first paint: keep every formula visible without waiting for MathJax. */
export declare function materializeMarkdownMathFallbackHtml(html: string, slots: MarkdownMathSlot[]): string;
/** 完整管线：保护公式 → marked.parse → 还原 SVG。 */
export declare function parseMarkdownWithMath(markdown: string, parseMarkdown: (src: string) => string): Promise<string>;
//# sourceMappingURL=markdown-math.d.ts.map