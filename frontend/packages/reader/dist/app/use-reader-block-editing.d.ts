import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { RegionHoverStore } from "../shared/state/region-hover-store.js";
import type { ReaderPaneComposition } from "./pane-composition.js";
export declare function useReaderBlockEditing(c: ReaderReactController, visiblePdfMode: ReaderPaneComposition["visibleMode"], regionHover: RegionHoverStore): {
    blockEdit: import("../hooks/use-reader-block-edit.js").ReaderBlockEdit;
    editBlock: (itemId: string) => void;
    revisedBlocks: import("../hooks/use-reader-revised-blocks.js").RevisedBlocks;
};
//# sourceMappingURL=use-reader-block-editing.d.ts.map