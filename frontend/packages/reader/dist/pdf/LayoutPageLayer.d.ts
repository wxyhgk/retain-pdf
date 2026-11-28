import { type ReactElement } from "react";
import { type RenderLayoutPage } from "../shared/data/render-layout.js";
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
export declare function LayoutPageLayer({ page, width, height, fontFamily, arrivedAt, charRise }: {
    page: RenderLayoutPage;
    width: number;
    height: number;
    /** 字体栈（清单里的字体，按顺序当后备）。 */
    fontFamily: string;
    arrivedAt: number;
    /** 逐字浮现（HTML 页菜单里的开关）。 */
    charRise?: boolean;
}): ReactElement;
export {};
//# sourceMappingURL=LayoutPageLayer.d.ts.map