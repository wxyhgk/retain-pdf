// 盖在书上的：放大查看（从 ReaderAppReactPdf 拆出，2026-11-27；交叉引用的预览和「回到第 N 页」同日挪进了交叉引用扩展）。
import type { ReactElement } from "react";

import { ReaderZoomViewer } from "../components/react-pdf/ReaderZoomViewer.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { ReaderPaneComposition } from "./pane-composition.js";
import type { useReaderPdfAssets } from "./use-reader-pdf-assets.js";

type Assets = ReturnType<typeof useReaderPdfAssets>;

export function ReaderOverlays({
  session,
  zoomDocuments,
  zoomItem,
  setZoomItem,
  closeZoom,
  visiblePdfMode,
}: {
  session: Pick<ReaderReactController["session"], "regions" | "readerMetadata">;
  zoomDocuments: Assets["zoomDocuments"];
  zoomItem: string | null;
  setZoomItem: (itemId: string | null) => void;
  closeZoom: () => void;
  visiblePdfMode: ReaderPaneComposition["visibleMode"];
}): ReactElement {
  return (
    <>
      {zoomItem ? (
        <ReaderZoomViewer
          itemId={zoomItem}
          regions={session.regions}
          metadata={session.readerMetadata}
          documents={zoomDocuments}
          panes={visiblePdfMode === "compare" ? ["source", "translated"] : visiblePdfMode === "translated" ? ["translated"] : ["source"]}
          onNavigate={setZoomItem}
          onClose={closeZoom}
        />
      ) : null}
    </>
  );
}
