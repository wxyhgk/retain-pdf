import { type ReactElement } from "react";
import type { PdfOutlineNode } from "../../pdf/pdf-outline.js";
/** 顶栏左边的「目录」按钮：固定 / 收起目录（和卡片顶上的图钉同一个开关）。书里没有目录（没书签、也没认出标题）时灰掉。 */
export declare function ReaderTocToggle({ pinned, available, onToggle }: {
    pinned: boolean;
    available: boolean;
    onToggle: () => void;
}): ReactElement;
export declare function ReaderTocMinimap({ bookmarks, onJumpPage, onJumpBlock, pinned, docked, onPinChange }: {
    /** PDF 自带的书签（有就按它列）。 */
    bookmarks: readonly PdfOutlineNode[];
    onJumpPage: (page: number) => void;
    /** 按标题来的目录跳到那一块。 */
    onJumpBlock: (itemId: string) => void;
    /** 固定了（图钉、顶栏「目录」按钮）：卡片一直开着。 */
    pinned?: boolean;
    /** 固定成实占的一栏（屏够宽时阅读页把它摆进中间工作区最左边）：不画短横线，只画卡片的内容。 */
    docked?: boolean;
    /** 点图钉；浮着固定时在卡片里按 Esc 是 false。 */
    onPinChange?: (pinned: boolean) => void;
}): ReactElement | null;
//# sourceMappingURL=ReaderTocMinimap.d.ts.map