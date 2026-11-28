import { type ReactElement } from "react";
import { type RenderLayoutLine, type RenderLayoutPage, type RenderLayoutSource } from "../shared/data/render-layout.js";
import { type RegionPdfDocument } from "./RegionCanvas.js";
type MathSvg = {
    viewBox: string;
    inner: string;
};
/** MathJax 给的 <mjx-container><svg viewBox …>…</svg></mjx-container> → viewBox 和里面那一层（套进我们自己的 <svg> 里）。 */
export declare function parseMathSvg(html: string | null): MathSvg | null;
/** 公式里一项一项的那几项：从 MathJax 的 math 节点往下，只有一个孩子（mrow 这类）就接着往下，到有几项的那一层。 */
export declare function formulaTerms(svg: Element): Element[];
/**
 * 点公式分步展开：各项依次从上面落下来、淡进来（MathJax 的单位是 1000 一个 em，-600 是往上 0.6em），公式闪一下蓝。
 * 闪色写死浅冷的蓝（和选区一个色系）：--accent 在黑白纸墨的皮肤里就是墨色，闪了看不出来（2026-11-28 实测）。
 */
export declare function playFormula(svg: SVGElement): void;
export declare function LayoutPageLayer({ page, width, height, fontFamily, arrivedAt, charRise, loadMath, fontByKey, findTerm }: {
    page: RenderLayoutPage;
    width: number;
    height: number;
    /** 字体栈（清单里的字体，按顺序当后备）。 */
    fontFamily: string;
    arrivedAt: number;
    /** 逐字浮现（HTML 页菜单里的开关）。 */
    charRise?: boolean;
    /** 取后端存的公式 SVG（版面来源的 loadMath）。 */
    loadMath?: (svg: string) => Promise<string | null>;
    /** 字簇的 font（清单 fonts[].key）→ 浏览器里的字体名：版面写明了用哪个字体就照它画（后面还接着整个字体栈）。 */
    fontByKey?: ReadonlyMap<string, string>;
    /** 左栏搜索的词：命中的字底下画一块底色（和 PDF 文字层的 mark.reader-find-mark 一样）。 */
    findTerm?: string;
}): ReactElement;
/**
 * 一行里搜索词命中的横向范围（pt）：把行里的字簇接成一串找（不分大小写），命中的字簇从它的 x 到下一个字簇的 x
 * （最后一个到行尾）。公式不参与。
 */
export declare function layoutFindSpans(line: RenderLayoutLine, term: string): [number, number][];
/**
 * 一页：从版面来源取这一页（按页取，接口有 ETag），先画底图（去掉原字的原文页；没有底图就是底下的原文页），再画版面。
 * 版面里没有这一页（整页图、不翻的参考文献）就什么都不画，看到的是原文页。
 */
export declare function LayoutPageHost({ source, page, width, height, fontFamily, arrivedAt, charRise, backgroundPdf, findTerm, coverWhileLoading }: {
    source: RenderLayoutSource;
    page: number;
    width: number;
    height: number;
    fontFamily: string;
    arrivedAt: number;
    charRise?: boolean;
    /** 底图的 PDF（读好了才有）。 */
    backgroundPdf: RegionPdfDocument | null;
    findTerm?: string;
    /** 这一页还在取时整页盖上纸色（译文栏：不让底下的原文先露出来）。 */
    coverWhileLoading?: boolean;
}): ReactElement | null;
export {};
//# sourceMappingURL=LayoutPageLayer.d.ts.map