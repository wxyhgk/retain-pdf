/** 抽出 [1] [2]…，避免 marked 当成 reference link。 */
export declare function protectNumericCitations(source: string): {
    text: string;
    refs: string[];
};
export declare function restoreNumericCitations(html: string, refs: string[]): string;
/** 流式预览：轻量转义 + 换行，保留 [n] 字面量。 */
export declare function renderStreamingPreviewHtml(text: string): string;
export declare function peekFinalAnswerHtmlCache(text: string): string | null;
/**
 * 最终答案 HTML：保护引用 → 保护公式 → marked → MathJax → 还原引用。
 */
export declare function renderFinalAnswerHtml(text: string): Promise<string>;
//# sourceMappingURL=render-answer-html.d.ts.map