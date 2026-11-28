import { type ReactElement } from "react";
import type { PdfOutlineNode } from "../../pdf/pdf-outline.js";
export declare function ReaderTocMinimap({ bookmarks, onJumpPage, onJumpBlock, pinned, docked, onPinChange }: {
    /** PDF 自带的书签（有就按它列）。 */
    bookmarks: readonly PdfOutlineNode[];
    onJumpPage: (page: number) => void;
    /** 按标题来的目录跳到那一块。 */
    onJumpBlock: (itemId: string) => void;
    /** 固定了（卡片顶上的图钉）：卡片一直开着。 */
    pinned?: boolean;
    /** 固定成实占的一栏（屏够宽时阅读页把它摆进中间工作区最左边）：不画短横线，只画卡片的内容。 */
    docked?: boolean;
    /** 点图钉；浮着固定时在卡片里按 Esc 是 false。 */
    onPinChange?: (pinned: boolean) => void;
}): ReactElement | null;
//# sourceMappingURL=ReaderTocMinimap.d.ts.map