// PDF một cột: cột không tự cuộn; trục dọc do shared scroll shell phụ trách (khớp reader-scroll-shell cũ).
// Đồng bộ chiều cao hàng đối chiếu do usePageRowSync ở parent xử lý, không dùng display:contents.

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document } from "react-pdf";
import {
  useProtectedPdfFile,
  type ProtectedPdfFile,
} from "./useProtectedPdfFile.js";
import { setupReactPdf } from "./setup-react-pdf.js";
import { pageWidthFromShell } from "./reader-zoom.js";
import { PdfPageSlot } from "./PdfPageSlot.js";
import type { PageRowHeights } from "./usePageRowSync.js";
import type { ReaderPaneId } from "./reader-dom-contract.js";

/**
 * Page width tính theo "toàn bộ chiều rộng shell x zoom%", không phụ thuộc chiều rộng cột hiện tại.
 * Với ngữ nghĩa này, pageWidthOverride nên truyền toàn bộ chiều rộng shell (không phải nửa chiều rộng).
 */

setupReactPdf();

function readerDevicePixelRatio(): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(1, Math.min(dpr, 2));
}

export type PdfDocumentPaneProps = {
  pane: ReaderPaneId;
  url?: string;
  preloadedFile?: ProtectedPdfFile | null;
  userZoom?: number;
  visible?: boolean;
  emptyLabel?: string;
  scrollRoot?: HTMLElement | null;
  /**
   * Toàn bộ chiều rộng vùng đọc (shell clientWidth).
   * Chiều rộng render page = pageWidthFromShell(giá trị này, userZoom), không đổi theo một cột/nửa cột.
   */
  pageWidthOverride?: number | null;
  /** Đồng bộ chiều cao hàng đối chiếu. */
  rowHeights?: PageRowHeights;
  onMetrics?: () => void;
  onLoadSuccess?: (info: { numPages: number; pane: ReaderPaneId }) => void;
  onLoadError?: (error: Error, pane: ReaderPaneId) => void;
  onNumPagesChange?: (numPages: number, pane: ReaderPaneId) => void;
};

const PdfDocumentPaneInner = forwardRef<HTMLElement, PdfDocumentPaneProps>(
  function PdfDocumentPaneInner(
    {
      pane,
      url = "",
      preloadedFile = null,
      userZoom = 1,
      visible = true,
      emptyLabel = "Chưa có PDF",
      scrollRoot = null,
      pageWidthOverride = null,
      rowHeights,
      onMetrics,
      onLoadSuccess,
      onLoadError,
      onNumPagesChange,
    },
    ref,
  ) {
    const { file, loading, error: fetchError } = useProtectedPdfFile(url, preloadedFile);
    const [numPages, setNumPages] = useState(0);
    const [docError, setDocError] = useState("");
    const [paneEl, setPaneEl] = useState<HTMLElement | null>(null);
    const [paneWidth, setPaneWidth] = useState(480);
    const widthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastWidthRef = useRef(0);
    const dpr = useMemo(() => readerDevicePixelRatio(), []);

    useImperativeHandle(ref, () => paneEl as HTMLElement, [paneEl]);

    // Page width chỉ theo toàn bộ chiều rộng shell + zoom, cấm dùng clientWidth của cột này (đối chiếu sẽ thành 25%).
    useEffect(() => {
      const w = pageWidthOverride && pageWidthOverride >= 80
        ? pageWidthOverride
        : (scrollRoot?.clientWidth || 0);
      if (!Number.isFinite(w) || w < 80) return;
      if (Math.abs(w - lastWidthRef.current) < 8) return;
      lastWidthRef.current = w;
      setPaneWidth(w);
    }, [pageWidthOverride, scrollRoot, visible]);

    // Đồng bộ khi kích thước shell thay đổi.
    useEffect(() => {
      if (!scrollRoot || typeof ResizeObserver === "undefined") return;
      if (pageWidthOverride && pageWidthOverride >= 80) return;
      const ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect?.width ?? scrollRoot.clientWidth;
        if (!Number.isFinite(w) || w < 80) return;
        if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
        widthTimerRef.current = setTimeout(() => {
          if (Math.abs(w - lastWidthRef.current) < 8) return;
          lastWidthRef.current = w;
          setPaneWidth(w);
        }, 80);
      });
      ro.observe(scrollRoot);
      return () => {
        ro.disconnect();
        if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
      };
    }, [scrollRoot, pageWidthOverride]);

    const pageWidth = useMemo(
      () => pageWidthFromShell(paneWidth, userZoom),
      [paneWidth, userZoom],
    );

    const handleLoadSuccess = useCallback(
      ({ numPages: pages }: { numPages: number }) => {
        setNumPages(pages);
        setDocError("");
        onNumPagesChange?.(pages, pane);
        onLoadSuccess?.({ numPages: pages, pane });
      },
      [onLoadSuccess, onNumPagesChange, pane],
    );

    const handleLoadError = useCallback(
      (err: Error) => {
        const message = err?.message || "Không phân tích được PDF";
        setDocError(message);
        setNumPages(0);
        onNumPagesChange?.(0, pane);
        onLoadError?.(err, pane);
      },
      [onLoadError, onNumPagesChange, pane],
    );

    const pageNumbers = useMemo(
      () => (numPages > 0 ? Array.from({ length: numPages }, (_, i) => i + 1) : []),
      [numPages],
    );

    const showEmpty = !url || Boolean(fetchError) || Boolean(docError);
    const emptyText = !url
      ? emptyLabel
      : fetchError || docError || emptyLabel;

    return (
      <section
        ref={setPaneEl}
        className={`reader-panel reader-react-pdf-pane${visible ? "" : " is-hidden"}`}
        data-reader-pane={pane}
        data-reader-engine="react-pdf"
        data-reader-visible={visible ? "true" : "false"}
        aria-hidden={visible ? undefined : true}
        aria-label={pane === "source" ? "PDF gốc" : "PDF bản dịch"}
      >
        {showEmpty && !loading ? (
          <div className="reader-empty reader-react-pdf-empty" data-reader-pdf-empty={pane}>
            {emptyText}
          </div>
        ) : null}
        {loading ? (
          <div className="reader-empty reader-react-pdf-loading" data-reader-pdf-loading={pane}>
            Đang tải PDF...
          </div>
        ) : null}
        {file && !fetchError ? (
          <div className="reader-viewer-wrap reader-react-pdf-wrap">
            <Document
              file={file}
              loading={null}
              error={null}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={handleLoadError}
              className="reader-react-pdf-document"
            >
              {pageNumbers.map((pageNumber) => (
                <PdfPageSlot
                  key={`${pane}-${pageNumber}`}
                  pane={pane}
                  pageNumber={pageNumber}
                  width={pageWidth}
                  devicePixelRatio={dpr}
                  scrollRoot={scrollRoot}
                  syncedMinHeight={rowHeights?.get(pageNumber) || 0}
                  onMetrics={onMetrics}
                />
              ))}
            </Document>
          </div>
        ) : null}
      </section>
    );
  },
);

export const PdfDocumentPane = memo(PdfDocumentPaneInner);
