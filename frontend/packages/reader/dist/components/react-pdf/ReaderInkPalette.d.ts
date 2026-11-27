import { type ReactElement } from "react";
import { type ReaderInk } from "../../hooks/use-reader-ink.js";
/** 右键菜单里画笔那一排（画笔扩展登记的 menuSection；菜单本身是 ReaderPageMenu）。 */
export declare function ReaderInkMenuSection({ ink, page, onPick }: {
    ink: ReaderInk;
    page: number;
    onPick: () => void;
}): ReactElement;
/** 画笔模式下左下角常驻的那一条。 */
export declare function ReaderInkDock({ ink }: {
    ink: ReaderInk;
}): ReactElement | null;
/** P 进入 / 退出画笔，Esc 退出，画笔模式下 ⌘Z / Ctrl+Z 撤销。 */
export declare function useInkShortcuts(ink: ReaderInk): void;
//# sourceMappingURL=ReaderInkPalette.d.ts.map