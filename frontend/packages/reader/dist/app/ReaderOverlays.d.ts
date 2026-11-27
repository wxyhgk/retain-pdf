import type { ReactElement } from "react";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { ReaderPaneComposition } from "./pane-composition.js";
import type { useReaderPdfAssets } from "./use-reader-pdf-assets.js";
type Assets = ReturnType<typeof useReaderPdfAssets>;
export declare function ReaderOverlays({ session, zoomDocuments, zoomItem, setZoomItem, closeZoom, visiblePdfMode, }: {
    session: Pick<ReaderReactController["session"], "regions" | "readerMetadata">;
    zoomDocuments: Assets["zoomDocuments"];
    zoomItem: string | null;
    setZoomItem: (itemId: string | null) => void;
    closeZoom: () => void;
    visiblePdfMode: ReaderPaneComposition["visibleMode"];
}): ReactElement;
export {};
//# sourceMappingURL=ReaderOverlays.d.ts.map