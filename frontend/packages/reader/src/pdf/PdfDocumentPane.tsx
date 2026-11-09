// 单栏 PDF：栏不滚动；纵向由共享 scroll shell 负责。
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
import type { ReactNode } from "react";
import {
  cloneProtectedPdfFileForWorker,
  useProtectedPdfFile,
  type ProtectedPdfFile,
} from "./useProtectedPdfFile.js";
import { setupReactPdf } from "./setup-react-pdf.js";
import {
  pageWidthFromShell,
  READER_WIDTH_SETTLE_MS,
  resolveReaderWidthCommit,
} from "./reader-zoom.js";
import { DEFAULT_ASPECT, PdfPageSlot } from "./PdfPageSlot.js";
import { createPdfRangeTransport, READER_PDF_RANGE_CHUNK } from "./pdf-range-transport.js";
import type { PageRowHeights } from "./usePageRowSync.js";
import {
  getPageAttr,
  READER_NATURAL_HEIGHT_ATTR,
  READER_PAGE_ATTR,
  READER_PAGE_SLOT_CLASS,
  READER_PANE_ATTR,
  READER_PDF_PAGE_PLACEHOLDER_CLASS,
  READER_PDF_PANE_CLASS,
  type ReaderPaneId,
} from "./reader-dom-contract.js";
import { readerPdfPort } from "../external.js";
import {
  findReaderRegion,
  resolveReaderRegionHighlight,
  type ReaderMetadata,
  type ReaderRegion,
} from "../shared/data/reader-regions.js";
import type { LiveTranslationState } from "../shared/data/live-translation-state.js";

const OVERSCAN = 5;
/** Pre-warm/active band: same root margin the old per-slot observer used. */
const ACTIVE_ROOT_MARGIN = "120% 0px";
/** Leave grace period so edge scrolling does not rapidly unmount the canvas. */
const ACTIVE_LEAVE_MS = 120;
/**
 * 文字层（pdf.js 的 textLayer，一页几百上千个绝对定位的 span）和实时译文框只给眼前的页（上下各多 1/4 屏）挂，
 * 画布照旧按 ACTIVE_ROOT_MARGIN 预热。WebKit 里每个绝对定位的元素都是一个 RenderLayer，每次排版、滚动都要
 * 把它们全走一遍（computeCompositingRequirements）：挂着 11 页的文字层时，作者的 app 里滑动、拖分隔线主线程
 * 85–100% 忙，大头就在这。
 */
const TEXT_ROOT_MARGIN = "25% 0px";
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

type PdfDocumentPaneProps = {
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
  /** 对照阅读时两栏共享的悬停块（见 PdfPageSlot）。 */
  hoveredRegionId?: string | null;
  onHoverRegion?: (itemId: string | null) => void;
  liveTranslation?: LiveTranslationState;
  /** Render live translation blocks in this pane, independent of source/translated identity. */
  showLiveTranslation?: boolean;
  /** Non-fatal live-translation wait state shown over the still-valid source canvas. */
  liveTranslationPendingLabel?: string;
  /** 栏右上角动作（如源栏「译文」叠加开关）。 */
  paneAction?: ReactNode;
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
      hoveredRegionId = null,
      onHoverRegion,
      liveTranslation,
      showLiveTranslation = pane === "source",
      liveTranslationPendingLabel = "",
      paneAction,
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
    // 一般的：每个 Document 一份字节副本（pdf.js 会把它转移给 worker）；按段取的大文件：每个 Document 一个新的取段 transport。
    const documentFile = useMemo(() => {
      const own = cloneProtectedPdfFileForWorker(file);
      if (!own) return null;
      if ("ranged" in own) return { range: createPdfRangeTransport(own.ranged) };
      return own;
    }, [file, url]);
    const [numPages, setNumPages] = useState(0);
    const [docError, setDocError] = useState("");
    const [paneEl, setPaneEl] = useState<HTMLElement | null>(null);
    const [paneWidth, setPaneWidth] = useState(480);
    const widthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastWidthRef = useRef(0);
    const dpr = useMemo(() => readerDevicePixelRatio(), []);
    const documentOptions = useMemo(() => ({
      cMapUrl: readerPdfPort().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: true,
      standardFontDataUrl: readerPdfPort().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: READER_PDF_RANGE_CHUNK,
      disableAutoFetch: true,
    }), []);

    useImperativeHandle(ref, () => paneEl as HTMLElement, [paneEl]);

    // 单一 width 同步：初始 + ResizeObserver，避免双 effect 重复计算。
    //
    // **变化要等布局稳定再提交**，理由写在 resolveReaderWidthCommit 上：这个
    // width 直接决定 react-pdf 重画 canvas，而 shell 宽度在开关面板（180ms 过渡）
    // 和拖分栏（每帧）时是连续变化的。
    //
    // 这里原来两条分支的待遇不一样：ResizeObserver 那条有 80ms 防抖，而
    // pageWidthOverride 那条是**立即提交、零防抖** —— 偏偏 override 恒有值
    // （ReaderCompareGrid 总是传 pageWidthBasis），所以带防抖的那条从来不走，
    // 而真正会连续变化的那条一点都没防。
    useEffect(() => {
      const commit = (w: number) => {
        lastWidthRef.current = w;
        setPaneWidth(w);
      };
      const syncWidth = (w: number) => {
        const decision = resolveReaderWidthCommit(w, lastWidthRef.current);
        if (decision === "ignore") return;
        if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
        if (decision === "immediate") {
          commit(w);
          return;
        }
        widthTimerRef.current = setTimeout(() => commit(w), READER_WIDTH_SETTLE_MS);
      };
      const hasOverride = Boolean(pageWidthOverride && pageWidthOverride >= 80);
      syncWidth(hasOverride ? (pageWidthOverride as number) : (scrollRoot?.clientWidth || 0));

      // **只有一个出口。** 原来这里有三条 return，每条都得自己记得清定时器，
      // 而漏掉的那条的表现是「卸载之后 setState」—— 控制台一句警告，没有测试
      // 会红。提前 return 换成条件挂载，清理只写一遍。
      const observe = !hasOverride && scrollRoot && typeof ResizeObserver !== "undefined";
      const ro = observe
        ? new ResizeObserver((entries) => {
            syncWidth(entries[0]?.contentRect?.width ?? scrollRoot.clientWidth);
          })
        : null;
      if (ro && scrollRoot) ro.observe(scrollRoot);
      return () => {
        ro?.disconnect();
        if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
      };
    }, [pageWidthOverride, scrollRoot, visible]);

    const pageWidth = useMemo(
      () => pageWidthFromShell(paneWidth, userZoom),
      [paneWidth, userZoom],
    );

    // --- virtualization: aspect cache keeps placeholder heights correct when windowed out ---
    const [aspectCache, setAspectCache] = useState<Map<number, number>>(() => new Map());
    // nearPages: pages inside the ACTIVE_ROOT_MARGIN band (pre-warm + windowing source).
    // activePages: nearPages with a 120ms leave hysteresis (canvas mount decision).
    const [nearPages, setNearPages] = useState<Set<number>>(() => new Set());
    const [activePages, setActivePages] = useState<Set<number>>(() => new Set());
    const sentinelRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const windowingObserverRef = useRef<IntersectionObserver | null>(null);
    const textObserverRef = useRef<IntersectionObserver | null>(null);
    const [textPages, setTextPages] = useState<Set<number>>(() => new Set());
    const activeLeaveTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

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
      const observers = [windowingObserverRef.current, textObserverRef.current];
      if (prev) {
        for (const observer of observers) {
          try {
            observer?.unobserve(prev);
          } catch {
            // ignore
          }
        }
      }
      if (el) {
        map.set(pn, el);
        for (const observer of observers) {
          try {
            observer?.observe(el);
          } catch {
            // ignore
          }
        }
      } else {
        map.delete(pn);
      }
    }, []);

    // One stable ref callback per page. Inline `(el) => registerSentinel(...)`
    // callbacks are recreated on every render, which (a) invalidates
    // memo(PdfPageSlot) for every page when the pane re-renders and (b) makes
    // React detach/re-attach placeholder refs, churning the observer. Caching
    // by page keeps both identities stable for the life of the pane.
    const sentinelCallbacksRef = useRef<Map<number, (el: HTMLDivElement | null) => void>>(new Map());
    const getSentinelRef = useCallback((pn: number) => {
      const callbacks = sentinelCallbacksRef.current;
      let callback = callbacks.get(pn);
      if (!callback) {
        callback = (el: HTMLDivElement | null) => registerSentinel(pn, el);
        callbacks.set(pn, callback);
      }
      return callback;
    }, [registerSentinel]);

    // Single pane-level observer replaces the old pair (pane window + per-slot
    // shared observer). It uses the slot's former 120% root margin, then:
    //   - nearPages drives the +/- OVERSCAN mount window (same window semantics)
    //   - activePages applies the 120ms leave hysteresis for canvas mounting
    // so each page sentinel is observed exactly once and unmount decisions are
    // no longer duplicated across two observers.
    useEffect(() => {
      if (typeof IntersectionObserver === "undefined") return;
      const leaveTimers = activeLeaveTimersRef.current;
      const obs = new IntersectionObserver(
        (entries) => {
          const entering: number[] = [];
          const leaving: number[] = [];
          for (const ent of entries) {
            const target = ent.target as HTMLElement;
            const pn = getPageAttr(target);
            if (!Number.isFinite(pn)) continue;
            (ent.isIntersecting ? entering : leaving).push(pn);
          }
          if (entering.length || leaving.length) {
            setNearPages((prev) => {
              let next: Set<number> | null = null;
              for (const pn of entering) {
                if (!prev.has(pn)) {
                  next = next || new Set(prev);
                  next.add(pn);
                }
              }
              for (const pn of leaving) {
                if (prev.has(pn)) {
                  next = next || new Set(prev);
                  next.delete(pn);
                }
              }
              return next || prev;
            });
          }
          if (entering.length) {
            for (const pn of entering) {
              const timer = leaveTimers.get(pn);
              if (timer) {
                clearTimeout(timer);
                leaveTimers.delete(pn);
              }
            }
            setActivePages((prev) => {
              let next: Set<number> | null = null;
              for (const pn of entering) {
                if (!prev.has(pn)) {
                  next = next || new Set(prev);
                  next.add(pn);
                }
              }
              return next || prev;
            });
          }
          for (const pn of leaving) {
            if (leaveTimers.has(pn)) continue;
            leaveTimers.set(pn, setTimeout(() => {
              leaveTimers.delete(pn);
              setActivePages((prev) => {
                if (!prev.has(pn)) return prev;
                const next = new Set(prev);
                next.delete(pn);
                return next;
              });
            }, ACTIVE_LEAVE_MS));
          }
        },
        { root: scrollRoot, rootMargin: ACTIVE_ROOT_MARGIN, threshold: 0 },
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
        for (const timer of leaveTimers.values()) clearTimeout(timer);
        leaveTimers.clear();
      };
    }, [scrollRoot]);

    // 眼前的页（TEXT_ROOT_MARGIN）：只有它们挂文字层和实时译文框。
    useEffect(() => {
      if (typeof IntersectionObserver === "undefined") return;
      const obs = new IntersectionObserver(
        (entries) => {
          setTextPages((prev) => {
            let next: Set<number> | null = null;
            for (const ent of entries) {
              const pn = getPageAttr(ent.target as HTMLElement);
              if (!Number.isFinite(pn) || ent.isIntersecting === prev.has(pn)) continue;
              next = next || new Set(prev);
              if (ent.isIntersecting) next.add(pn);
              else next.delete(pn);
            }
            return next || prev;
          });
        },
        { root: scrollRoot, rootMargin: TEXT_ROOT_MARGIN, threshold: 0 },
      );
      textObserverRef.current = obs;
      for (const el of sentinelRefs.current.values()) {
        try {
          obs.observe(el);
        } catch {
          // ignore
        }
      }
      return () => {
        obs.disconnect();
        if (textObserverRef.current === obs) textObserverRef.current = null;
      };
    }, [scrollRoot]);
    const textWindowed = !!scrollRoot && typeof IntersectionObserver !== "undefined";

    // A pane survives Reader route changes. Clear every document-derived value
    // before paint so pages/errors from document A cannot flash inside document B.
    // Include the resolved file identity because an authoritative refresh may
    // replace bytes while retaining the same protected URL.
    useLayoutEffect(() => {
      setNumPages(0);
      setDocError("");
      setNearPages(new Set());
      setActivePages(new Set());
      setAspectCache(new Map());
      sentinelRefs.current.clear();
      const leaveTimers = activeLeaveTimersRef.current;
      for (const timer of leaveTimers.values()) clearTimeout(timer);
      leaveTimers.clear();
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

    // No IntersectionObserver (SSR / legacy env): render every windowed canvas,
    // matching the old per-slot fallback where active defaulted to true.
    useEffect(() => {
      if (typeof IntersectionObserver !== "undefined") return;
      setActivePages(new Set(pageNumbers));
    }, [pageNumbers]);

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
    // 悬停块在本栏落在哪几页（跨页的块会有两页）。
    const hoveredPages = useMemo(() => {
      const pages = new Set<number>();
      if (!hoveredRegionId) return pages;
      for (const [page, list] of regionTargetsByPage) {
        if (list.some((highlight) => highlight.itemId === hoveredRegionId)) pages.add(page);
      }
      return pages;
    }, [hoveredRegionId, regionTargetsByPage]);

    // 批注按 block_id 找到对应的 region，再按 pane 解析成 bbox —— 和 regions
    // 完全同一条路。一条批注因此在原文栏和译文栏各自定位：锚点是语义的
    // （block_id），不是某张 PDF 的坐标。
    //
    // 锚不到的批注（block_id 在这本书里不存在）直接不画。**不猜位置** —— 贴错
    // 地方的批注比没有批注更糟，而且你看不出它贴错了。
    const windowedSet = useMemo(() => {
      if (numPages === 0) return new Set<number>();
      // **不可见时收到最小集，而不是关掉虚拟化。**
      //
      // 原来 visible 参与 canWindow，于是「这一栏看不见」的效果是把窗口开到
      // 全书：500 页的书切一次模式，另一栏立刻挂载几百个 PdfPageSlot，各自带
      // ReaderTextHoverLayer 和一个 useMemo ——
      // 而这一栏一个像素都不显示。canvas 确实没挂，但几百个组件的同步渲染是
      // 实打实的卡顿。
      //
      // 顺带：第 1 条阅读锚点的 bug 能成立正是靠这个 —— 隐藏栏的页槽全在 DOM
      // 里，measurePageScrollProgress 才过得了 `pages.length` 那道闸。
      if (!visible) return new Set<number>();
      const canWindow = !!scrollRoot && typeof IntersectionObserver !== "undefined";
      if (!canWindow) return new Set(pageNumbers);
      if (nearPages.size === 0) {
        const end = Math.min(numPages, OVERSCAN * 2 + 1);
        return new Set(Array.from({ length: end }, (_, i) => i + 1));
      }
      const s = new Set<number>();
      for (const v of nearPages) {
        for (let d = -OVERSCAN; d <= OVERSCAN; d++) {
          const n = v + d;
          if (n >= 1 && n <= numPages) s.add(n);
        }
      }
      return s;
    }, [numPages, pageNumbers, scrollRoot, visible, nearPages]);

    const showEmpty = !url || Boolean(fetchError) || Boolean(docError);
    const emptyText = !url
      ? emptyLabel
      : fetchError || docError || emptyLabel;

    return (
      <section
        ref={setPaneEl}
        className={`reader-panel ${READER_PDF_PANE_CLASS}${visible ? "" : " is-hidden"}`}
        {...{ [READER_PANE_ATTR]: pane }}
        data-reader-engine="react-pdf"
        data-reader-visible={visible ? "true" : "false"}
        data-live-translation-status={liveTranslation?.jobStatus || undefined}
        aria-hidden={visible ? undefined : true}
        aria-label={pane === "source" ? "原文 PDF" : "译文 PDF"}
      >
        {paneAction ? (
          <div className="reader-react-pdf-pane-action">{paneAction}</div>
        ) : null}
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
                      active={activePages.has(pageNumber)}
                      textLayer={!textWindowed || textPages.has(pageNumber)}
                      syncedMinHeight={rowHeights?.get(pageNumber) || 0}
                      onMetrics={onMetrics}
                      cachedAspect={aspectCache.get(pageNumber)}
                      onAspectChange={handleAspectChange}
                      sentinelRef={getSentinelRef(pageNumber)}
                      regionHighlight={regionHighlight?.box.page === pageNumber ? regionHighlight : null}
                      regionTargets={regionTargetsByPage.get(pageNumber)}
                      // 只交给含这一块的页：悬停一变，其它页的 props 不变，不重渲染。
                      hoveredRegionId={hoveredRegionId && hoveredPages.has(pageNumber) ? hoveredRegionId : null}
                      onHoverRegion={onHoverRegion}
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
                    ref={getSentinelRef(pageNumber)}
                    {...{
                      [READER_PAGE_ATTR]: pageNumber,
                      [READER_PANE_ATTR]: pane,
                      [READER_NATURAL_HEIGHT_ATTR]: naturalHeight,
                    }}
                    // is-placeholder：不定位（react-pdf.css）。WebKit 里定位的元素各占一个 RenderLayer，481 页的书
                    // 光空页槽就 962 个，比文字层还多，每次排版、滚动都要走一遍。
                    className={`${READER_PAGE_SLOT_CLASS} is-placeholder`}
                    style={{
                      width: pageWidth,
                      height: boxHeight,
                      minHeight: boxHeight,
                    }}
                  >
                    <div
                      className={READER_PDF_PAGE_PLACEHOLDER_CLASS}
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
