import { type ReactElement } from "react";
import type { PdfOutlineNode } from "../../pdf/pdf-outline.js";
/** 顶栏左边的「目录」按钮：钉住 / 收起左缘的目录卡。书里没有目录（没书签、也没认出标题）时灰掉。 */
export declare function ReaderTocToggle({ pinned, available, onToggle }: {
    pinned: boolean;
    available: boolean;
    onToggle: () => void;
}): ReactElement;
export declare function ReaderTocMinimap({ bookmarks, onJumpPage, onJumpBlock, pinned, onUnpin }: {
    /** PDF 自带的书签（有就按它列）。 */
    bookmarks: readonly PdfOutlineNode[];
    onJumpPage: (page: number) => void;
    /** 按标题来的目录跳到那一块。 */
    onJumpBlock: (itemId: string) => void;
    /** 顶栏「目录」按钮钉住了：卡片一直开着。 */
    pinned?: boolean;
    /** 钉住时在卡片里按 Esc。 */
    onUnpin?: () => void;
}): ReactElement | null;
//# sourceMappingURL=ReaderTocMinimap.d.ts.map