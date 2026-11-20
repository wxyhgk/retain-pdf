import { type ReactElement } from "react";
import { type ReaderInk } from "../../hooks/use-reader-ink.js";
export type InkMenuState = {
    x: number;
    y: number;
    page: number;
} | null;
/** 右键书页弹出的菜单（钉在鼠标位置，贴边时往里收）。 */
export declare function ReaderInkMenu({ ink, menu, onClose }: {
    ink: ReaderInk;
    menu: InkMenuState;
    onClose: () => void;
}): ReactElement | null;
/** 画笔模式下左下角常驻的那一条。 */
export declare function ReaderInkDock({ ink }: {
    ink: ReaderInk;
}): ReactElement | null;
/** 右键：书页区里出画笔菜单（Shift+右键、输入框里照旧是浏览器的菜单）。返回要不要接这次右键。 */
export declare function inkMenuFromContextMenu(event: {
    shiftKey: boolean;
    target: EventTarget | null;
    clientX: number;
    clientY: number;
}): InkMenuState;
/** P 进入 / 退出画笔，Esc 退出，画笔模式下 ⌘Z / Ctrl+Z 撤销。 */
export declare function useInkShortcuts(ink: ReaderInk): void;
//# sourceMappingURL=ReaderInkPalette.d.ts.map