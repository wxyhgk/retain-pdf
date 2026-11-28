import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { RegionPdfDocument } from "../pdf/RegionCanvas.js";
export declare function useReaderPdfAssets(c: ReaderReactController): {
    bookmarks: PdfOutlineNode[];
    onPdfOutline: (nodes: PdfOutlineNode[], pane: "source" | "translated") => void;
    onPdfDocument: (pdf: RegionPdfDocument, pane: "source" | "translated") => void;
    zoomItem: string;
    setZoomItem: import("react").Dispatch<import("react").SetStateAction<string>>;
    zoomBlock: (itemId: string) => void;
    closeZoom: () => void;
    zoomDocuments: {
        source: RegionPdfDocument;
        translated: RegionPdfDocument;
    };
};
//# sourceMappingURL=use-reader-pdf-assets.d.ts.map