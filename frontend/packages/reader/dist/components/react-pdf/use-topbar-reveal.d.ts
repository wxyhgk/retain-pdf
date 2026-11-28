import { type RefObject } from "react";
export declare const TOPBAR_REVEAL_ZONE_PX = 72;
export declare const TOPBAR_HIDE_DELAY_MS = 1500;
export declare const TOPBAR_FIRST_SHOW_MS = 2000;
export declare const TOPBAR_FLASH_MS = 1200;
/** 鼠标离书页区顶多远算「到顶上了」。 */
export declare function isInRevealZone(pointerY: number, stageTop: number): boolean;
/** 顶栏这时露不露。`bar` 是顶栏本身，它的父元素（书页区）上听鼠标。 */
export declare function useTopBarReveal(bar: RefObject<HTMLElement | null>, mode: string): boolean;
//# sourceMappingURL=use-topbar-reveal.d.ts.map