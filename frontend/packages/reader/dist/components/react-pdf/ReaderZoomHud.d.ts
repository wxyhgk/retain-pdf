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
    /** 页码后面放的按钮（宿主自己加；阅读页不放，搜索在左栏）。 */
    searchSlot?: ReactNode;
    /** 左边最前面、书签前面（阅读页：搜索——打开左栏，2026-11-28 从顶栏左边挪下来）。 */
    startSlot?: ReactNode;
    /** 左边书签后面（阅读页：改了译文还没排进 PDF 的提示）。 */
    leftSlot?: ReactNode;
    /** 右边快捷键前面（阅读页：ReaderBarTools place="bottom"，画笔 ▾、截图）。 */
    toolsSlot?: ReactNode;
};
export declare function ReaderZoomHud(props: ReaderZoomHudProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderZoomHud.d.ts.map