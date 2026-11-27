// 盖在书上的几样：交叉引用的悬停预览、「回到第 N 页」、放大查看（从 ReaderAppReactPdf 拆出，2026-11-27）。
import type { ReactElement } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { ReaderXrefPreview } from "../components/react-pdf/ReaderXrefPreview.js";
import { ReaderZoomViewer } from "../components/react-pdf/ReaderZoomViewer.js";
import type { useReaderXrefs } from "../hooks/use-reader-xrefs.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { ReaderPaneComposition } from "./pane-composition.js";
import type { useReaderPdfAssets } from "./use-reader-pdf-assets.js";

type Assets = ReturnType<typeof useReaderPdfAssets>;

export function ReaderOverlays({
  session,
  xrefs,
  zoomDocuments,
  zoomItem,
  setZoomItem,
  closeZoom,
  visiblePdfMode,
}: {
  session: Pick<ReaderReactController["session"], "regions" | "readerMetadata">;
  xrefs: ReturnType<typeof useReaderXrefs>;
  zoomDocuments: Assets["zoomDocuments"];
  zoomItem: string | null;
  setZoomItem: (itemId: string | null) => void;
  closeZoom: () => void;
  visiblePdfMode: ReaderPaneComposition["visibleMode"];
}): ReactElement {
  return (
    <>
      {xrefs.preview ? (
        <ReaderXrefPreview preview={xrefs.preview} regions={session.regions} metadata={session.readerMetadata} documents={zoomDocuments} />
      ) : null}
      {xrefs.canGoBack ? (
        <Button className="reader-xref-back" title="回到跳之前读到的地方（Alt+←）" onClick={() => xrefs.goBack()}>
          <ArrowLeft size={14} aria-hidden /> 回到第 {xrefs.backPage} 页
        </Button>
      ) : null}
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
