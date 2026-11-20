import { type RefObject } from "react";
/** 纯判断，方便测：这次滚动后底栏该不该藏。 */
export declare function nextHudHidden(hidden: boolean, downSoFar: number, delta: number): {
    hidden: boolean;
    downSoFar: number;
};
export declare function useHudAutoHide(rootRef: RefObject<HTMLElement | null>): boolean;
//# sourceMappingURL=use-hud-autohide.d.ts.map