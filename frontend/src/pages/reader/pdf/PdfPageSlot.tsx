// Một page: khớp createManualPageElement + setManualPageSize cũ (width/height cố định).
// Khi đối chiếu, syncedMinHeight lấy max height từ syncReaderPageRows.

import { memo, useEffect, useRef, useState } from "react";
import { Page } from "react-pdf";
import {
  READER_PAGE_SLOT_CLASS,
  type ReaderPaneId,
} from "./reader-dom-contract.js";

const DEFAULT_ASPECT = 1.414;
const ROOT_MARGIN = "120% 0px";

export type PdfPageSlotProps = {
  pageNumber: number;
  width: number;
  devicePixelRatio: number;
  scrollRoot: HTMLElement | null;
  pane?: ReaderPaneId;
  /** Max height của cùng trang hai bên khi đối chiếu. */
  syncedMinHeight?: number;
  onMetrics?: () => void;
};

function PdfPageSlotInner({
  pageNumber,
  width,
  devicePixelRatio,
  scrollRoot,
  pane,
  syncedMinHeight = 0,
  onMetrics,
}: PdfPageSlotProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setActive(true);
        }
      },
      { root: scrollRoot, rootMargin: ROOT_MARGIN, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot, pageNumber]);

  // Engine cũ cố định page height = viewport * scale.
  const naturalHeight = Math.max(120, Math.floor(width * aspect));
  const boxHeight = Math.max(naturalHeight, Math.ceil(syncedMinHeight || 0));

  return (
    <div
      ref={slotRef}
      data-reader-page={pageNumber}
      data-reader-pane={pane}
      data-natural-height={naturalHeight}
      className={READER_PAGE_SLOT_CLASS}
      style={{
        width,
        height: boxHeight,
        minHeight: boxHeight,
      }}
    >
      {active ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          devicePixelRatio={devicePixelRatio}
          renderTextLayer
          renderAnnotationLayer={false}
          className="reader-react-pdf-page"
          loading={
            <div
              className="reader-react-pdf-page-placeholder"
              style={{ width, height: naturalHeight }}
            />
          }
          onLoadSuccess={(page) => {
            try {
              const viewport = page.getViewport({ scale: 1 });
              if (viewport.width > 0) {
                const next = viewport.height / viewport.width;
                setAspect((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
              }
            } catch {
              // ignore
            }
            onMetrics?.();
          }}
          onRenderSuccess={() => {
            onMetrics?.();
          }}
        />
      ) : (
        <div
          className="reader-react-pdf-page-placeholder"
          style={{ width, height: naturalHeight }}
          aria-hidden
        />
      )}
    </div>
  );
}

export const PdfPageSlot = memo(PdfPageSlotInner);
