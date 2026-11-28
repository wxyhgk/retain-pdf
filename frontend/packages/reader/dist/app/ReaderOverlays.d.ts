import type { ReactElement } from "react";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { TranslatedLayout } from "../hooks/reader-session/translated-layout.js";
import type { ReaderPaneComposition } from "./pane-composition.js";
import type { useReaderPdfAssets } from "./use-reader-pdf-assets.js";
type Assets = ReturnType<typeof useReaderPdfAssets>;
export declare function ReaderOverlays({ session, zoomDocuments, zoomItem, setZoomItem, closeZoom, visiblePdfMode, translatedLayout, }: {
    session: Pick<ReaderReactController["session"], "regions" | "readerMetadata">;
    zoomDocuments: Assets["zoomDocuments"];
    zoomItem: string | null;
    setZoomItem: (itemId: string | null) => void;
    closeZoom: () => void;
    visiblePdfMode: ReaderPaneComposition["visibleMode"];
    /** 译文栏用 HTML 画（没有译文 PDF）：放大译文那一块时用原文页加版面。 */
    translatedLayout?: TranslatedLayout | null;
}): ReactElement;
export {};
//# sourceMappingURL=ReaderOverlays.d.ts.map