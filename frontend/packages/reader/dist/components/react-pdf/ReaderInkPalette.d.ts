import { type ReactElement } from "react";
import { type ReaderInk } from "../../hooks/use-reader-ink.js";
/** 画笔那一排：右键菜单里（画笔扩展登记的 menuSection；菜单本身是 ReaderPageMenu）和底栏「画笔 ▾」弹出来的都是它。 */
export declare function ReaderInkMenuSection({ ink, page, onPick }: {
    ink: ReaderInk;
    page?: number;
    onPick: () => void;
}): ReactElement;
/** P 进入 / 退出画笔，Esc 退出，画笔模式下 ⌘Z / Ctrl+Z 撤销。 */
export declare function useInkShortcuts(ink: ReaderInk): void;
//# sourceMappingURL=ReaderInkPalette.d.ts.map