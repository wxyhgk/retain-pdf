import { type ReactElement } from "react";
import type { RegionFraction } from "../pdf/RegionCanvas.js";
export type AskCropResult = {
    page: number;
    pane: "source" | "translated";
    region: RegionFraction;
    /** 截的那张画布（没有 pdf.js 文档时从它裁）。 */
    canvas: HTMLCanvasElement | null;
    /** 按下的那一点（拼出处用）。 */
    point: {
        x: number;
        y: number;
        target: Element;
    };
};
/** 屏幕上这一点下面的书页：页号、栏、画好的那张画布。 */
export declare function pageUnder(x: number, y: number, root?: Document): {
    readonly page: number;
    readonly pane: "source" | "translated";
    readonly canvas: HTMLCanvasElement;
    readonly slot: Element;
};
export declare function ReaderAskCrop({ onDone, onCancel }: {
    onDone: (result: AskCropResult) => void;
    onCancel: () => void;
}): ReactElement;
//# sourceMappingURL=ReaderAskCrop.d.ts.map