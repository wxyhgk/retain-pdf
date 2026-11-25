import type { Frame } from "../render/frame.js";
import type { Box } from "../layout/layout.js";
import { type RenderedMath } from "../layout/measure.js";
export type MathLookup = (tex: string, size: "s" | "m" | "l") => RenderedMath | null;
type Props = {
    frame: Frame;
    math: MathLookup;
    /** clipPath 等 id 的前缀，同一页多块板时不撞（useId）。 */
    idPrefix: string;
    title?: string;
};
type Point = {
    x: number;
    y: number;
};
/** 箭头从哪条边出、到哪条边：目标在下面就上下连，在右边就左右连，否则连中心。 */
export declare function arrowEnds(from: Box, to: Box): {
    start: Point;
    end: Point;
};
/** 能级图里每条能级的纵向位置：能量越高越靠上；全一样时放中间。 */
export declare function levelYs(energies: readonly number[], top: number, bottom: number): number[];
export declare function BoardSvg({ frame, math, idPrefix, title }: Props): import("react").JSX.Element;
export {};
