import type { ReaderRegion } from "../shared/data/reader-regions.js";
import type { ReaderBlockEdit } from "../hooks/use-reader-block-edit.js";
import type { ReaderTextHoverTarget } from "./ReaderTextHoverLayer.js";
export declare const READER_INLINE_EDIT_CLASS = "reader-inline-edit";
export declare function ReaderInlineBlockEditor({ target, page, edit, showSource, regions, jumpToBlock, }: {
    target: ReaderTextHoverTarget;
    page: {
        width: number;
        height: number;
    };
    edit: ReaderBlockEdit;
    /** 只看译文（左边没有原文）时框顶上放一行原文。 */
    showSource: boolean;
    regions: readonly ReaderRegion[] | null | undefined;
    jumpToBlock?: (itemId: string) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=ReaderInlineBlockEditor.d.ts.map