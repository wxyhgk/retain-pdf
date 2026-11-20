import { type ReactElement } from "react";
import { type InkPane, type ReaderInk } from "../hooks/use-reader-ink.js";
export declare const READER_INK_LAYER_CLASS = "reader-ink-layer";
/** 一串比例坐标 → SVG 路径（按这一页的像素宽高放大）。只有一个点时画成一个小圆点。 */
export declare function inkPath(points: ReadonlyArray<[number, number]>, width: number, height: number): string;
export declare function InkLayer({ page, pane, width, height, ink }: {
    page: number;
    pane: InkPane;
    width: number;
    height: number;
    ink: ReaderInk;
}): ReactElement | null;
//# sourceMappingURL=InkLayer.d.ts.map