/** 放大查看一块（图、表、公式、一段文字）：盖在书上的大框，这一块按高分辨率重新画（RegionCanvas），放多大都清楚。
 *
 * - 打开：悬停框工具条上的「放大」；图片也可以双击（文字块的双击留给浏览器选词）。
 * - 对照时原文、译文那一块左右并排（两份 PDF 都有、这一块两边都有位置时）。
 * - 框里：⌘/Ctrl + 滚轮、+ / − 放大缩小，拖着或滚动看；← → 换到书里上一块 / 下一块同类的（图翻图，字翻字）；Esc 关。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { Button, IconButton } from "@retainpdf/ui";

import {
  projectReaderRegion,
  readerRegionKindForRegion,
  resolveReaderRegionHighlight,
  type ReaderMetadata,
  type ReaderRegion,
} from "../../shared/data/reader-regions.js";
import { RegionCanvas, padRegion, type RegionFraction, type RegionPdfDocument } from "../../pdf/RegionCanvas.js";

export type ZoomPane = "source" | "translated";

export type ReaderZoomDocuments = Partial<Record<ZoomPane, RegionPdfDocument | null>>;

const KIND_LABEL: Record<string, string> = { figure: "图", table: "表", formula: "公式", text: "文字" };
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4] as const;

/** 一块在某一栏里画哪一页的哪一块（比例）；这一栏没有位置或没有页面尺寸时为 null。 */
export function zoomRegionIn(region: ReaderRegion, metadata: ReaderMetadata | null, pane: ZoomPane): ZoomPlace | null {
  const highlight = resolveReaderRegionHighlight(region, metadata, pane);
  const rect = highlight ? projectReaderRegion(highlight, 1, 1) : null;
  if (!highlight || !rect) return null;
  const fraction = padRegion({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  const { width, height } = highlight.pageSize;
  return { page: highlight.box.page, fraction, aspect: (fraction.height * height) / Math.max(1e-6, fraction.width * width) };
}

type ZoomPlace = { page: number; fraction: RegionFraction; /** 高 / 宽 */ aspect: number };

/** 100% 时一栏画多宽：先占满栏宽，太高（高的图、整页的表）就按放得下的高度缩，打开不用先滚。 */
export function zoomFitWidth(columnWidth: number, availableHeight: number, aspects: readonly number[]): number {
  const tallest = Math.max(0, ...aspects);
  if (tallest <= 0 || availableHeight <= 0) return columnWidth;
  return Math.round(Math.max(120, Math.min(columnWidth, availableHeight / tallest)));
}

/** 书里同一类的块（图和表算一类「图表」，公式一类，文字一类），按阅读顺序。← → 在里面走。 */
export function zoomSiblings(regions: readonly ReaderRegion[], current: ReaderRegion): ReaderRegion[] {
  const group = (region: ReaderRegion) => {
    const kind = readerRegionKindForRegion(region);
    return kind === "figure" || kind === "table" ? "visual" : kind;
  };
  const wanted = group(current);
  return regions.filter((region) => group(region) === wanted);
}

export function ReaderZoomViewer({
  itemId,
  regions,
  metadata,
  documents,
  panes,
  onNavigate,
  onClose,
}: {
  itemId: string;
  regions: readonly ReaderRegion[];
  metadata: ReaderMetadata | null;
  documents: ReaderZoomDocuments;
  /** 画哪几栏（对照时两栏，否则当前那一栏）。 */
  panes: readonly ZoomPane[];
  onNavigate: (itemId: string) => void;
  onClose: () => void;
}): ReactElement | null {
  const region = regions.find((entry) => entry.itemId === itemId) ?? null;
  const siblings = useMemo(() => (region ? zoomSiblings(regions, region) : []), [regions, region]);
  const index = region ? siblings.indexOf(region) : -1;
  const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1));
  const zoom = ZOOM_STEPS[zoomIndex];
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const measure = () => setBodyWidth(body.clientWidth);
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(body);
    return () => observer?.disconnect();
  }, []);

  const step = useCallback((delta: number) => {
    const next = siblings[index + delta];
    if (next) onNavigate(next.itemId);
  }, [siblings, index, onNavigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoomIndex((value) => Math.min(ZOOM_STEPS.length - 1, value + 1));
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoomIndex((value) => Math.max(0, value - 1));
      } else if (event.key === "0") {
        event.preventDefault();
        setZoomIndex(ZOOM_STEPS.indexOf(1));
      } else {
        return;
      }
      // 阅读页自己的快捷键（翻页、缩放书页）这时不该动。
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, step]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoomIndex((value) => Math.max(0, Math.min(ZOOM_STEPS.length - 1, value + (event.deltaY < 0 ? 1 : -1))));
    };
    body.addEventListener("wheel", onWheel, { passive: false });
    return () => body.removeEventListener("wheel", onWheel);
  }, []);

  // 拖着看（放大以后）。
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  if (!region) return null;
  const kind = readerRegionKindForRegion(region);
  const shown = panes
    .map((pane) => ({ pane, pdf: documents[pane] ?? null, where: zoomRegionIn(region, metadata, pane) }))
    .filter((entry): entry is { pane: ZoomPane; pdf: RegionPdfDocument; where: ZoomPlace } => Boolean(entry.pdf && entry.where));
  const gap = 16;
  // 框最高 min(880, 90vh)，减去顶栏、留白、「原文 / 译文」那行字。
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const availableHeight = Math.min(880, viewportHeight * 0.9) - 56 - 32 - (shown.length > 1 ? 26 : 0);
  const columnWidth = shown.length
    ? zoomFitWidth(Math.max(120, (bodyWidth - gap * (shown.length - 1) - 32) / shown.length), availableHeight, shown.map((entry) => entry.where.aspect))
    : 0;
  const page = shown[0]?.where.page ?? region.source.page;

  return (
    <div className="reader-zoom" role="dialog" aria-modal="true" aria-label={`放大查看：${KIND_LABEL[kind] ?? "这一块"}`}>
      <div className="reader-zoom-backdrop" onClick={onClose} />
      <section className="reader-zoom-panel">
        <header className="reader-zoom-head">
          <span className="reader-zoom-title">{KIND_LABEL[kind] ?? "这一块"} · 第 {page} 页</span>
          <span className="reader-zoom-count">{index >= 0 ? `${index + 1} / ${siblings.length}` : ""}</span>
          <div className="reader-zoom-tools">
            <IconButton variant="ghost" size="sm" label="上一块" title="上一块（←）" disabled={index <= 0} onClick={() => step(-1)}>
              <ChevronLeft size={16} aria-hidden />
            </IconButton>
            <IconButton variant="ghost" size="sm" label="下一块" title="下一块（→）" disabled={index < 0 || index >= siblings.length - 1} onClick={() => step(1)}>
              <ChevronRight size={16} aria-hidden />
            </IconButton>
            <IconButton variant="ghost" size="sm" label="缩小" title="缩小（−）" disabled={zoomIndex === 0} onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}>
              <Minus size={16} aria-hidden />
            </IconButton>
            <Button variant="ghost" size="sm" className="reader-zoom-level" aria-label="回到 100%" title="回到 100%（0）" onClick={() => setZoomIndex(ZOOM_STEPS.indexOf(1))}>
              {Math.round(zoom * 100)}%
            </Button>
            <IconButton variant="ghost" size="sm" label="放大" title="放大（+、⌘/Ctrl + 滚轮）" disabled={zoomIndex === ZOOM_STEPS.length - 1} onClick={() => setZoomIndex((value) => Math.min(ZOOM_STEPS.length - 1, value + 1))}>
              <Plus size={16} aria-hidden />
            </IconButton>
            <IconButton variant="ghost" size="sm" label="关掉" title="关掉（Esc）" onClick={onClose}>
              <X size={16} aria-hidden />
            </IconButton>
          </div>
        </header>
        <div
          ref={bodyRef}
          className="reader-zoom-body"
          onPointerDown={(event) => {
            const body = bodyRef.current;
            if (!body || event.button !== 0) return;
            drag.current = { x: event.clientX, y: event.clientY, left: body.scrollLeft, top: body.scrollTop };
            body.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const body = bodyRef.current;
            const start = drag.current;
            if (!body || !start) return;
            body.scrollLeft = start.left - (event.clientX - start.x);
            body.scrollTop = start.top - (event.clientY - start.y);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {shown.length && bodyWidth ? (
            <div className="reader-zoom-columns" style={{ gap }}>
              {shown.map(({ pane, pdf, where }) => (
                <figure key={pane} className="reader-zoom-column">
                  {shown.length > 1 ? <figcaption>{pane === "source" ? "原文" : "译文"}</figcaption> : null}
                  <RegionCanvas
                    className="reader-zoom-canvas"
                    pdf={pdf}
                    page={where.page}
                    region={where.fraction}
                    cssWidth={columnWidth * zoom}
                    label={`${pane === "source" ? "原文" : "译文"}第 ${where.page} 页`}
                  />
                </figure>
              ))}
            </div>
          ) : (
            <p className="reader-zoom-empty">{bodyWidth ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : ""}</p>
          )}
        </div>
      </section>
    </div>
  );
}
