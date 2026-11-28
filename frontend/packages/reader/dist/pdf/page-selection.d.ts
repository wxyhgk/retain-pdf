export declare const SELECTABLE_LAYER = ".textLayer, .reader-layout-page, .reader-html-page";
export declare function elementOfNode(node: Node | null): Element | null;
/** 选区所在的那一层（开头那头先，没有就看结尾那头）。 */
export declare function selectionLayerOf(range: Range): Element | null;
/**
 * 版面层（一个字簇一个 <text>，公式是一个嵌套的 <svg>）里选中的字：按文档顺序拼，
 * 基线（y）变了是新的一行（换行，后面 cleanPdfSelectionText 会接成空格或直接接上），换了一块是新的一段（空一行）；
 * 同一行两簇之间隔得开（> 0.2 个字号）、两边又是西文时补一个空格；公式整个算进来，写成 $LaTeX$。
 */
export declare function layoutSelectionText(range: Range, root: Element): string;
/** 选区的原文（还没收拾）：碰到版面层的按版面拼，别的用浏览器自己的。 */
export declare function selectionRawText(selection: Selection): string;
/** 选区收拾好的字（复制、收藏、提问都用这个）。 */
export declare function selectionCleanText(selection: Selection): string;
//# sourceMappingURL=page-selection.d.ts.map