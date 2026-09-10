// 单栏 PDF：栏不滚动；纵向由共享 scroll shell 负责（对齐旧 reader-scroll-shell）。
// 对照等高由父级 usePageRowSync 完成，不做 display:contents。

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document } from "react-pdf";
import {
  cloneProtectedPdfFileForWorker,
  useProtectedPdfFile,
  type ProtectedPdfFile,
} from "./useProtectedPdfFile.js";
import { setupReactPdf } from "./setup-react-pdf.js";
import { pageWidthFromShell } from "./reader-zoom.js";
import { DEFAULT_ASPECT, PdfPageSlot } from "./PdfPageSlot.js";
import type { PageRowHeights } from "./usePageRowSync.js";
import { READER_PAGE_SLOT_CLASS, type ReaderPaneId } from "./reader-dom-contract.js";
import { resolvePdfjsVendorUrl } from "../external.js";
import {
  resolveReaderRegionHighlight,
  type ReaderMetadata,
  type ReaderRegion,
  type ReaderRegionSelection,
} from "../shared/data/reader-regions.js";
import type { LiveTranslationState } from "../shared/data/live-translation-state.js";

const OVERSCAN = 5;
let nextPdfFileIdentity = 1;
const pdfFileIdentities = new WeakMap<ProtectedPdfFile, number>();

function pdfFileIdentity(file: ProtectedPdfFile | null): number {
  if (!file) return 0;
  const existing = pdfFileIdentities.get(file);
  if (existing) return existing;
  const next = nextPdfFileIdentity;
  nextPdfFileIdentity += 1;
  pdfFileIdentities.set(file, next);
  return next;
}

/**
 * 页宽按「shell 全宽 × zoom%」计算，与当前栏宽无关。
 * pageWidthOverride 在此语义下应传 shell 全宽（不是半宽）。
 */

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
   * 阅读区全宽（shell clientWidth）。
   * 页绘制宽 = pageWidthFromShell(此值, userZoom)，不随单栏/半栏变化。
   */
  pageWidthOverride?: number | null;
  /** 对照行高同步 */
  rowHeights?: PageRowHeights;
  onMetrics?: () => void;
  onLoadSuccess?: (info: { numPages: number; pane: ReaderPaneId }) => void;
  onLoadError?: (error: Error, pane: ReaderPaneId) => void;
  onNumPagesChange?: (numPages: number, pane: ReaderPaneId) => void;
  activeRegion?: ReaderRegion | null;
  regions?: ReaderRegion[];
  readerMetadata?: ReaderMetadata | null;
  onSelectRegion?: (selection: ReaderRegionSelection) => void;
  liveTranslation?: LiveTranslationState;
  /** Render live translation blocks in this pane, independent of source/translated identity. */
  showLiveTranslation?: boolean;
  /** Non-fatal live-translation wait state shown over the still-valid source canvas. */
  liveTranslationPendingLabel?: string;
};

const PdfDocumentPaneInner = forwardRef<HTMLElement, PdfDocumentPaneProps>(
  function PdfDocumentPaneInner(
    {
      pane,
      url = "",
      preloadedFile = null,
      userZoom = 1,
      visible = true,
      emptyLabel = "暂无 PDF",
      scrollRoot = null,
      pageWidthOverride = null,
      rowHeights,
      onMetrics,
      onLoadSuccess,
      onLoadError,
      onNumPagesChange,
      activeRegion = null,
      regions = [],
      readerMetadata = null,
      onSelectRegion,
      liveTranslation,
      showLiveTranslation = pane === "source",
      liveTranslationPendingLabel = "",
    },
    ref,
  ) {
    // 渲染期配置 worker，而不是模块顶层：workerSrc 取自宿主注入的 adapters，
    // 模块求值时机由打包器的 chunk 顺序决定，不保证晚于 adapters 注入。
    setupReactPdf();
    const { file, loading, error: fetchError } = useProtectedPdfFile(url, preloadedFile);
    const documentIdentity = `${url}\u0000${pdfFileIdentity(file)}`;
    const activeDocumentIdentityRef = useRef(documentIdentity);
    activeDocumentIdentityRef.current = documentIdentity;
    const documentFile = useMemo(
      () => cloneProtectedPdfFileForWorker(file),
      [file, url],
    );
    const [numPages, setNumPages] = useState(0);
    const [docError, setDocError] = useState("");
    const [paneEl, setPaneEl] = useState<HTMLElement | null>(null);
    const [paneWidth, setPaneWidth] = useState(480);
    const widthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastWidthRef = useRef(0);
    const dpr = useMemo(() => readerDevicePixelRatio(), []);
    const documentOptions = useMemo(() => ({
      cMapUrl: resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: true,
      standardFontDataUrl: resolvePdfjsVendorUrl("standard_fonts/"),
    }), []);

    useImperativeHandle(ref, () => paneEl as HTMLElement, [paneEl]);

    // 单一 width 同步：初始 + ResizeObserver，避免双 effect 重复计算
    useEffect(() => {
      const syncWidth = (w: number) => {
        if (!Number.isFinite(w) || w < 80) return;
        if (Math.abs(w - lastWidthRef.current) < 8) return;
        lastWidthRef.current = w;
        setPaneWidth(w);
      };
      const initialW = pageWidthOverride && pageWidthOverride >= 80
        ? pageWidthOverride
        : (scrollRoot?.clientWidth || 0);
      syncWidth(initialW);
      if (!scrollRoot || typeof ResizeObserver === "undefined") return;
      if (pageWidthOverride && pageWidthOverride >= 80) return;
      const ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect?.width ?? scrollRoot.clientWidth;
        if (!Number.isFinite(w) || w < 80) return;
        if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
        widthTimerRef.current = setTimeout(() => syncWidth(w), 80);
      });
      ro.observe(scrollRoot);
      return () => {
        ro.disconnect();
        if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
      };
    }, [pageWidthOverride, scrollRoot, visible]);

    const pageWidth = useMemo(
      () => pageWidthFromShell(paneWidth, userZoom),
      [paneWidth, userZoom],
    );

    // --- virtualization: aspect cache keeps placeholder heights correct when windowed out ---
    const [aspectCache, setAspectCache] = useState<Map<number, number>>(() => new Map());
    const [visiblePages, setVisiblePages] = useState<Set<number>>(() => new Set());
    const sentinelRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const windowingObserverRef = useRef<IntersectionObserver | null>(null);

    const handleAspectChange = useCallback((pn: number, aspect: number) => {
      setAspectCache((prev) => {
        if (prev.get(pn) === aspect) return prev;
        const next = new Map(prev);
        next.set(pn, aspect);
        return next;
      });
    }, []);

    const registerSentinel = useCallback((pn: number, el: HTMLDivElement | null) => {
      const map = sentinelRefs.current;
      const prev = map.get(pn);
      if (prev && windowingObserverRef.current) {
        try {
          windowingObserverRef.current.unobserve(prev);
        } catch {
          // ignore
        }
      }
      if (el) {
        map.set(pn, el);
        if (windowingObserverRef.current) {
          try {
            windowingObserverRef.current.observe(el);
          } catch {
            // ignore
          }
        }
      } else {
        map.delete(pn);
      }
    }, []);

    // shared windowing observer: tracks which page sentinels are intersecting viewport
    // expands to +/- OVERSCAN to form windowed set. Keeps shared IntersectionObserver pattern for active toggling.
    useEffect(() => {
      if (!scrollRoot || typeof IntersectionObserver === "undefined") return;
      const obs = new IntersectionObserver(
        (entries) => {
          setVisiblePages((prev) => {
            const next = new Set(prev);
            let changed = false;
            for (const ent of entries) {
              const target = ent.target as HTMLElement;
              const pn = Number(target.getAttribute("data-reader-page"));
              if (!Number.isFinite(pn)) continue;
              if (ent.isIntersecting) {
                if (!next.has(pn)) {
                  next.add(pn);
                  changed = true;
                }
              } else {
                if (next.has(pn)) {
                  next.delete(pn);
                  changed = true;
                }
              }
            }
            return changed ? next : prev;
          });
        },
        { root: scrollRoot, rootMargin: "0px", threshold: 0 },
      );
      windowingObserverRef.current = obs;
      // observe any already-mounted sentinels
      for (const el of sentinelRefs.current.values()) {
        try {
          obs.observe(el);
        } catch {
          // ignore
        }
      }
      return () => {
        obs.disconnect();
        if (windowingObserverRef.current === obs) windowingObserverRef.current = null;
      };
    }, [scrollRoot]);

    // A pane survives Reader route changes. Clear every document-derived value
    // before paint so pages/errors from document A cannot flash inside document B.
    // Include the resolved file identity because an authoritative refresh may
    // replace bytes while retaining the same protected URL.
    useLayoutEffect(() => {
      setNumPages(0);
      setDocError("");
      setVisiblePages(new Set());
      setAspectCache(new Map());
      sentinelRefs.current.clear();
      onNumPagesChange?.(0, pane);
      // Keep the observer; it will re-observe new sentinels on next render.
    }, [documentIdentity, onNumPagesChange, pane]);

    const handleLoadSuccess = useCallback(
      ({ numPages: pages }: { numPages: number }) => {
        if (activeDocumentIdentityRef.current !== documentIdentity) return;
        setNumPages(pages);
        setDocError("");
        onNumPagesChange?.(pages, pane);
        onLoadSuccess?.({ numPages: pages, pane });
      },
      [documentIdentity, onLoadSuccess, onNumPagesChange, pane],
    );

    const handleLoadError = useCallback(
      (err: Error) => {
        if (activeDocumentIdentityRef.current !== documentIdentity) return;
        const message = err?.message || "PDF 解析失败";
        setDocError(message);
        setNumPages(0);
        onNumPagesChange?.(0, pane);
        onLoadError?.(err, pane);
      },
      [documentIdentity, onLoadError, onNumPagesChange, pane],
    );

    const pageNumbers = useMemo(
      () => (numPages > 0 ? Array.from({ length: numPages }, (_, i) => i + 1) : []),
      [numPages],
    );
    const regionHighlight = useMemo(
      () => resolveReaderRegionHighlight(activeRegion, readerMetadata, pane),
      [activeRegion, readerMetadata, pane],
    );
    const regionTargetsByPage = useMemo(() => {
      const map = new Map<number, NonNullable<ReturnType<typeof resolveReaderRegionHighlight>>[]>();
      for (const region of regions) {
        const highlight = resolveReaderRegionHighlight(region, readerMetadata, pane);
        if (!highlight) continue;
        const list = map.get(highlight.box.page) || [];
        list.push(highlight);
        map.set(highlight.box.page, list);
      }
      return map;
    }, [pane, readerMetadata, regions]);

    const windowedSet = useMemo(() => {
      if (numPages === 0) return new Set<number>();
      const canWindow = !!scrollRoot && typeof IntersectionObserver !== "undefined" && visible;
      if (!canWindow) return new Set(pageNumbers);
      if (visiblePages.size === 0) {
        const end = Math.min(numPages, OVERSCAN * 2 + 1);
        return new Set(Array.from({ length: end }, (_, i) => i + 1));
      }
      const s = new Set<number>();
      for (const v of visiblePages) {
        for (let d = -OVERSCAN; d <= OVERSCAN; d++) {
          const n = v + d;
          if (n >= 1 && n <= numPages) s.add(n);
        }
      }
      return s;
    }, [numPages, pageNumbers, scrollRoot, visible, visiblePages]);

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
        data-live-translation-status={liveTranslation?.jobStatus || undefined}
        aria-hidden={visible ? undefined : true}
        aria-label={pane === "source" ? "原文 PDF" : "译文 PDF"}
      >
        {liveTranslationPendingLabel ? (
          <div className="reader-live-translation-waiting" role="status">
            <span className="reader-live-translation-waiting-dot" aria-hidden="true" />
            <span>{liveTranslationPendingLabel}</span>
          </div>
        ) : null}
        {showEmpty && !loading ? (
          <div className="reader-empty reader-react-pdf-empty" data-reader-pdf-empty={pane}>
            {emptyText}
          </div>
        ) : null}
        {loading ? (
          <div className="reader-empty reader-react-pdf-loading" data-reader-pdf-loading={pane}>
            正在加载 PDF…
          </div>
        ) : null}
        {documentFile && !fetchError ? (
          <div className="reader-viewer-wrap reader-react-pdf-wrap">
            <Document
              key={documentIdentity}
              file={documentFile}
              loading={null}
              error={null}
              options={documentOptions}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={handleLoadError}
              className="reader-react-pdf-document"
            >
              {pageNumbers.map((pageNumber) => {
                const isWindowed = windowedSet.has(pageNumber);
                if (isWindowed) {
                  return (
                    <PdfPageSlot
                      key={`${pane}-${pageNumber}`}
                      pane={pane}
                      pageNumber={pageNumber}
                      width={pageWidth}
                      devicePixelRatio={dpr}
                      scrollRoot={scrollRoot}
                      syncedMinHeight={rowHeights?.get(pageNumber) || 0}
                      onMetrics={onMetrics}
                      cachedAspect={aspectCache.get(pageNumber)}
                      onAspectChange={handleAspectChange}
                      sentinelRef={(el) => registerSentinel(pageNumber, el)}
                      regionHighlight={regionHighlight?.box.page === pageNumber ? regionHighlight : null}
                      regionTargets={regionTargetsByPage.get(pageNumber)}
                      onSelectRegion={onSelectRegion}
                      liveTranslationLayout={liveTranslation?.layoutByPage.get(pageNumber - 1)}
                      liveTranslationPage={liveTranslation?.pagesByPage.get(pageNumber - 1)}
                      showLiveTranslation={showLiveTranslation}
                    />
                  );
                }
                // off-screen: keep placeholder div with correct height to preserve scroll height,
                // unmount Page canvas to free GPU memory (windowed rendering)
                const aspect = aspectCache.get(pageNumber) ?? DEFAULT_ASPECT;
                const naturalHeight = Math.max(120, Math.floor(pageWidth * aspect));
                const boxHeight = Math.max(naturalHeight, Math.ceil(rowHeights?.get(pageNumber) || 0));
                return (
                  <div
                    key={`${pane}-${pageNumber}`}
                    ref={(el) => registerSentinel(pageNumber, el)}
                    data-reader-page={pageNumber}
                    data-reader-pane={pane}
                    data-natural-height={naturalHeight}
                    className={READER_PAGE_SLOT_CLASS}
                    style={{
                      width: pageWidth,
                      height: boxHeight,
                      minHeight: boxHeight,
                    }}
                  >
                    <div
                      className="reader-react-pdf-page-placeholder"
                      style={{ width: pageWidth, height: naturalHeight }}
                      aria-hidden
                    />
                  </div>
                );
              })}
            </Document>
          </div>
        ) : null}
      </section>
    );
  },
);

export const PdfDocumentPane = memo(PdfDocumentPaneInner);
