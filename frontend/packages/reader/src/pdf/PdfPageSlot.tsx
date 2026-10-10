// 单页：对齐旧 createManualPageElement + setManualPageSize（固定宽高）
// 对照时 syncedMinHeight 来自 syncReaderPageRows 的 max 高度

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Page } from "react-pdf";
import {
  READER_NATURAL_HEIGHT_ATTR,
  READER_PAGE_ATTR,
  READER_PAGE_SLOT_CLASS,
  READER_PANE_ATTR,
  READER_PDF_PAGE_CLASS,
  READER_PDF_PAGE_PLACEHOLDER_CLASS,
  type ReaderPaneId,
} from "./reader-dom-contract.js";
import {
  projectReaderRegion,
  type ReaderRegionHighlight,
} from "../shared/data/reader-regions.js";
import {
  hitTestReaderTextHoverTarget,
  HOVER_TOOLS_HEIGHT,
  HOVER_TOOLS_WIDTH,
  hoverToolsOutside,
  projectReaderTextHoverTargets,
  READER_TEXT_HOVER_TOOLS_CLASS,
  ReaderTextHoverLayer,
} from "./ReaderTextHoverLayer.js";
import { LiveTranslationOverlay } from "./LiveTranslationOverlay.js";
import { useReaderContext } from "../components/react-pdf/reader-context.js";
import type { ReaderLiveTranslationLayoutPage as LiveTranslationLayoutPage } from "../contracts/live-translation.js";
import type { LiveTranslationPageState } from "../shared/data/live-translation-state.js";

export const DEFAULT_ASPECT = 1.414;

type PdfPageSlotProps = {
  pageNumber: number;
  width: number;
  devicePixelRatio: number;
  pane?: ReaderPaneId;
  /** pane-level windowing decides whether the page canvas should be mounted */
  active?: boolean;
  /** 对照左右同页 max 高度 */
  syncedMinHeight?: number;
  onMetrics?: () => void;
  /** windowed rendering: aspect cache from pane to keep placeholder height correct */
  cachedAspect?: number;
  onAspectChange?: (pageNumber: number, aspect: number) => void;
  /** pane-level windowing sentinel registration (the pane observer owns activeness) */
  sentinelRef?: (el: HTMLDivElement | null) => void;
  regionHighlight?: ReaderRegionHighlight | null;
  regionTargets?: ReaderRegionHighlight[];
  /**
   * 对照阅读时左右两栏共享的悬停块（itemId）。给了 onHoverRegion 就由外面管，
   * 鼠标在哪栏，两栏都画同一块的框；没给（单栏）就用本页自己的状态。
   */
  hoveredRegionId?: string | null;
  onHoverRegion?: (itemId: string | null) => void;
  liveTranslationLayout?: LiveTranslationLayoutPage;
  liveTranslationPage?: LiveTranslationPageState;
  showLiveTranslation?: boolean;
};

function PdfPageSlotInner({
  pageNumber,
  width,
  devicePixelRatio,
  pane,
  active = false,
  syncedMinHeight = 0,
  onMetrics,
  cachedAspect,
  onAspectChange,
  sentinelRef,
  regionHighlight = null,
  regionTargets = [],
  hoveredRegionId,
  onHoverRegion,
  liveTranslationLayout,
  liveTranslationPage,
  showLiveTranslation = pane === "source",
}: PdfPageSlotProps) {
  // 改过的块（来自阅读器上下文；单测里直接渲染时没有，就不画标记）。
  const revisedBlocks = useReaderContext()?.revisedBlocks;
  const aspectRef = useRef(cachedAspect ?? DEFAULT_ASPECT);
  const [aspect, setAspect] = useState(aspectRef.current);

  // keep local aspect in sync with pane-level cache (e.g. after remount)
  useEffect(() => {
    if (cachedAspect != null && Math.abs(cachedAspect - aspectRef.current) >= 0.001) {
      aspectRef.current = cachedAspect;
      setAspect(cachedAspect);
    }
  }, [cachedAspect]);

  const sentinelRefRef = useRef(sentinelRef);
  sentinelRefRef.current = sentinelRef;
  // Stable callback ref that forwards the slot node to the pane's per-page
  // sentinel registration. Keeping its identity stable avoids re-attaching the
  // observer on every render.
  const sentinelCallbackRef = useRef<(el: HTMLDivElement | null) => void>((el: HTMLDivElement | null) => {
    sentinelRefRef.current?.(el);
  }).current;

  // 旧引擎 page 固定 height = viewport * scale
  const naturalHeight = Math.max(120, Math.floor(width * aspect));
  const boxHeight = Math.max(naturalHeight, Math.ceil(syncedMinHeight || 0));
  const regionRect = projectReaderRegion(regionHighlight, width, naturalHeight);
  const textHoverTargets = useMemo(
    () => projectReaderTextHoverTargets(regionTargets, width, naturalHeight),
    [naturalHeight, regionTargets, width],
  );
  const [localHoveredTextId, setLocalHoveredTextId] = useState<string | null>(null);
  const controlled = typeof onHoverRegion === "function";
  const hoveredTextId = controlled ? hoveredRegionId ?? null : localHoveredTextId;
  const setHoveredTextId = (next: string | null) => {
    if (controlled) {
      if (next !== (hoveredRegionId ?? null)) onHoverRegion?.(next);
    } else {
      setLocalHoveredTextId((current) => (current === next ? current : next));
    }
  };
  const hoveredTextTarget = useMemo(
    () => textHoverTargets.find((target) => target.itemId === hoveredTextId) || null,
    [hoveredTextId, textHoverTargets],
  );

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    // 触屏没有悬停：手指滑动（滚动）不该换框，框由点按决定（见 handlePointerDown）。
    if (event.pointerType === "touch") return;
    // 拖选正文时隐藏轮廓，绝不接管 PDF textLayer 的事件。
    if (event.buttons !== 0) {
      setHoveredTextId(null);
      return;
    }
    // 鼠标在工具条（编号 / 复制）上：工具条可能在框外，按坐标命中会把框收掉，按钮就点不到了。
    if ((event.target as HTMLElement | null)?.closest?.(`.${READER_TEXT_HOVER_TOOLS_CLASS}`)) return;
    const hostRect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - hostRect.left;
    const y = event.clientY - hostRect.top;
    // 工具条在框外上方时（矮 / 窄的块，比如行间公式），鼠标斜着走向按钮可能先经过上面
    // 别的块。只在工具条自己那一小块范围里保持当前框 —— 以前保持的是框上方整条带，
    // 紧贴在上面的短块（比如图注）从下面就再也悬停不到了。
    const current = hoveredTextTarget?.rect;
    if (
      current
      && hoverToolsOutside(current)
      && x >= current.left - 4
      && x <= current.left + HOVER_TOOLS_WIDTH
      && y >= current.top - HOVER_TOOLS_HEIGHT
      && y <= current.top
    ) return;
    const target = hitTestReaderTextHoverTarget(textHoverTargets, x, y);
    setHoveredTextId(target?.itemId || null);
  };

  // 触屏 / 笔：点一下块就出框和「复制」（没有悬停可用）。点工具条本身不算（按钮自己
  // 拦了 pointerdown）。
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    const hostRect = event.currentTarget.getBoundingClientRect();
    const target = hitTestReaderTextHoverTarget(
      textHoverTargets,
      event.clientX - hostRect.left,
      event.clientY - hostRect.top,
    );
    setHoveredTextId(target?.itemId || null);
  };

  // notify pane of aspect so placeholder heights stay correct when windowed out.
  // onLoadSuccess is an async react-pdf callback, not render, so notifying the
  // parent directly is safe; the ref guard keeps StrictMode double-loads quiet.
  const handleAspect = (next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    if (Math.abs(aspectRef.current - next) < 0.001) return;
    aspectRef.current = next;
    setAspect(next);
    onAspectChange?.(pageNumber, next);
  };

  return (
    <div
      ref={sentinelCallbackRef}
      {...{
        [READER_PAGE_ATTR]: pageNumber,
        [READER_PANE_ATTR]: pane,
        [READER_NATURAL_HEIGHT_ATTR]: naturalHeight,
      }}
      className={READER_PAGE_SLOT_CLASS}
      // pdf.js text spans may handle pointer events themselves. Capture at the
      // page boundary so source-PDF hover hit testing stays active without
      // placing an interactive overlay above the native text selection layer.
      onPointerMoveCapture={handlePointerMove}
      onPointerDown={handlePointerDown}
      // 触屏抬手也会触发 pointerleave：那时框得留着，不然「复制」一闪就没了。
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHoveredTextId(null);
      }}
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
          className={READER_PDF_PAGE_CLASS}
          loading={
            <div
              className={READER_PDF_PAGE_PLACEHOLDER_CLASS}
              style={{ width, height: naturalHeight }}
            />
          }
          onLoadSuccess={(page) => {
            try {
              const viewport = page.getViewport({ scale: 1 });
              if (viewport.width > 0) {
                const next = viewport.height / viewport.width;
                handleAspect(next);
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
          className={READER_PDF_PAGE_PLACEHOLDER_CLASS}
          style={{ width, height: naturalHeight }}
          aria-hidden
        />
      )}
      {regionRect ? (
        <div
          className="reader-react-pdf-region-highlight"
          data-reader-region-id={regionHighlight?.itemId}
          style={regionRect}
          aria-hidden="true"
        />
      ) : null}
      {active && showLiveTranslation ? (
        <LiveTranslationOverlay
          layoutPage={liveTranslationLayout}
          pageState={liveTranslationPage}
          width={width}
          height={naturalHeight}
        />
      ) : null}
      {active && pane === "translated" && revisedBlocks?.size ? (
        <div className="reader-revised-markers" aria-hidden="true">
          {textHoverTargets.filter((target) => revisedBlocks.has(target.itemId)).map((target) => (
            <span
              key={target.itemId}
              className="reader-revised-marker"
              data-reader-revised-id={target.itemId}
              style={{ left: target.rect.left, top: target.rect.top, height: target.rect.height }}
            />
          ))}
        </div>
      ) : null}
      <ReaderTextHoverLayer
        target={active ? hoveredTextTarget : null}
        pane={pane === "translated" ? "translated" : "source"}
        revisedCount={hoveredTextTarget ? revisedBlocks?.get(hoveredTextTarget.itemId) || 0 : 0}
      />
    </div>
  );
}

export const PdfPageSlot = memo(PdfPageSlotInner);
