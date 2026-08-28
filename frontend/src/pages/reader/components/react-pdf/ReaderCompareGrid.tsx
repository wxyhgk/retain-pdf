import { PdfDocumentPane } from "../../pdf/PdfDocumentPane.js";
import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import type { PageRowHeights } from "../../pdf/usePageRowSync.js";
import {
  READER_SCROLL_SHELL_CLASS,
  READER_SCROLL_SHELL_ID,
} from "../../pdf/reader-dom-contract.js";

export type ReaderCompareGridProps = {
  mode: string; // ReaderMode
  bindShell: (node: HTMLDivElement | null) => void;
  shellEl: HTMLElement | null;
  userZoom: number;
  compareMode: boolean;
  /** Toàn bộ chiều rộng vùng đọc (shell), dùng để tính zoom% theo toàn màn. */
  shellWidth: number;
  /** @deprecated Giữ để tương thích; page width không dùng nửa cột nữa. */
  compareColWidth?: number;
  rowHeights?: PageRowHeights;
  mountSource: boolean;
  mountTranslated: boolean;
  showSource: boolean;
  showTranslated: boolean;
  sourceOnly: boolean;
  sourceUrl: string;
  translatedUrl: string;
  sourceFile: ProtectedPdfFile | null;
  translatedFile: ProtectedPdfFile | null;
  onMetrics: () => void;
  onNumPagesChange: (pages: number, pane: "source" | "translated") => void;
};

export function ReaderCompareGrid(props: ReaderCompareGridProps): JSX.Element {
  const {
    mode,
    bindShell,
    shellEl,
    userZoom,
    compareMode,
    shellWidth,
    rowHeights,
    mountSource,
    mountTranslated,
    showSource,
    showTranslated,
    sourceOnly,
    sourceUrl,
    translatedUrl,
    sourceFile,
    translatedFile,
    onMetrics,
    onNumPagesChange,
  } = props;

  return (
    <div
      ref={bindShell}
      id={READER_SCROLL_SHELL_ID}
      className={READER_SCROLL_SHELL_CLASS}
      data-reader-scroll-shell="true"
    >
      <main
        className={`reader-react-grid reader-mode-${mode}`}
        data-reader-mode={mode}
      >
        {mountSource ? (
          <PdfDocumentPane
            pane="source"
            url={sourceUrl}
            preloadedFile={sourceFile}
            userZoom={userZoom}
            visible={showSource}
            scrollRoot={shellEl}
            pageWidthOverride={shellWidth}
            rowHeights={compareMode ? rowHeights : undefined}
            onMetrics={onMetrics}
            emptyLabel={
              sourceOnly
                ? "Tệp nguồn không khả dụng: tài liệu này không có PDF gốc có thể đọc."
                : "Chưa có PDF gốc"
            }
            onNumPagesChange={onNumPagesChange}
          />
        ) : null}
        {mountTranslated ? (
          <PdfDocumentPane
            pane="translated"
            url={translatedUrl}
            preloadedFile={translatedFile}
            userZoom={userZoom}
            visible={showTranslated}
            scrollRoot={shellEl}
            pageWidthOverride={shellWidth}
            rowHeights={compareMode ? rowHeights : undefined}
            onMetrics={onMetrics}
            emptyLabel="Chưa có PDF bản dịch"
            onNumPagesChange={onNumPagesChange}
          />
        ) : null}
      </main>
    </div>
  );
}
