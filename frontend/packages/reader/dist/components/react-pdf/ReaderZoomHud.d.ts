import { type ReactNode } from "react";
import { type ReaderZoomMode } from "../../pdf/reader-zoom.js";
export type ReaderZoomHudProps = {
    /** 以下显示值缺省时从 reader context / hud context 取 */
    userZoom?: number;
    onZoomChange?: (zoom: number) => void;
    currentPage?: number;
    numPages?: number;
    onGoToPage?: (page: number) => void;
    /** 点百分比时重置到该模式默认缩放 */
    mode?: ReaderZoomMode | string;
    modeControls?: ReactNode;
    /** 书签按这本书存（和阅读位置同一个 scope）；不给就不显示书签。 */
    bookmarkScope?: string;
};
export declare function ReaderZoomHud(props: ReaderZoomHudProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderZoomHud.d.ts.map