import { type ReactNode } from "react";
import { type ReaderZoomMode } from "../../pdf/reader-zoom.js";
export type ReaderZoomHudProps = {
    userZoom: number;
    onZoomChange: (zoom: number) => void;
    currentPage: number;
    numPages: number;
    onGoToPage?: (page: number) => void;
    /** 点百分比时重置到该模式默认缩放 */
    mode?: ReaderZoomMode | string;
    modeControls?: ReactNode;
};
export declare function ReaderZoomHud({ userZoom, onZoomChange, currentPage, numPages, onGoToPage, mode, modeControls, }: ReaderZoomHudProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderZoomHud.d.ts.map