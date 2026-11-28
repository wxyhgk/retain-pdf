import { type ReactElement } from "react";
import { type RenderLayoutPage } from "../shared/data/render-layout.js";
type MathSvg = {
    viewBox: string;
    inner: string;
};
/** MathJax 给的 <mjx-container><svg viewBox …>…</svg></mjx-container> → viewBox 和里面那一层（套进我们自己的 <svg> 里）。 */
export declare function parseMathSvg(html: string | null): MathSvg | null;
export declare function LayoutPageLayer({ page, width, height, fontFamily, arrivedAt }: {
    page: RenderLayoutPage;
    width: number;
    height: number;
    /** 字体栈（清单里的字体，按顺序当后备）。 */
    fontFamily: string;
    arrivedAt: number;
}): ReactElement;
export {};
//# sourceMappingURL=LayoutPageLayer.d.ts.map