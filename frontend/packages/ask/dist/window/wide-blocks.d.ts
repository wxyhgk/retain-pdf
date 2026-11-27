import { type RefObject } from "react";
/** 最多缩到多少（再小字就看不清了，改成横着滚）。 */
export declare const MIN_FIT: number;
/** 内容宽 / 能放的宽 → 怎么放：放得下、缩一点、横着滚（缩放比例）。 */
export declare function fitPlan(contentWidth: number, boxWidth: number): {
    mode: "fits" | "fit" | "scroll";
    zoom: number;
};
/** 扫一遍：每块先还原再量，返回还要横着滚的块数。 */
export declare function fitWideBlocks(root: HTMLElement): number;
/** 盯着对话区：内容变了（流式写出来）、窗口宽窄变了，重新放一遍。返回还要横着滚的块数。 */
export declare function useWideBlocks(root: RefObject<HTMLElement | null>): number;
