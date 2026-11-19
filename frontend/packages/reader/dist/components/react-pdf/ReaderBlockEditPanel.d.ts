import type { ReaderRegion } from "../../shared/data/reader-regions.js";
import type { ReaderBlockEdit } from "../../hooks/use-reader-block-edit.js";
/** 能改的块（正文、公式、表格）按阅读顺序排好，给「上一段 / 下一段」用。 */
export declare function editableBlockIds(regions: readonly ReaderRegion[] | null | undefined): string[];
/** 顶上那条：还有几处没排进 PDF、排版进行到哪了。 */
export declare function PendingRerenderBar({ edit }: {
    edit: ReaderBlockEdit;
}): import("react").JSX.Element;
export declare function ReaderBlockEditPanel({ open, onClose, edit, regions, jumpToBlock, }: {
    open: boolean;
    onClose: () => void;
    edit: ReaderBlockEdit;
    regions: readonly ReaderRegion[] | null | undefined;
    jumpToBlock?: (itemId: string) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=ReaderBlockEditPanel.d.ts.map