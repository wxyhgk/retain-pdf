import { type ReactElement } from "react";
import type { PdfOutlineNode } from "../../pdf/pdf-outline.js";
export declare function ReaderTocMinimap({ bookmarks, onJumpPage, onJumpBlock }: {
    /** PDF 自带的书签（有就按它列）。 */
    bookmarks: readonly PdfOutlineNode[];
    onJumpPage: (page: number) => void;
    /** 按标题来的目录跳到那一块。 */
    onJumpBlock: (itemId: string) => void;
}): ReactElement | null;
//# sourceMappingURL=ReaderTocMinimap.d.ts.map