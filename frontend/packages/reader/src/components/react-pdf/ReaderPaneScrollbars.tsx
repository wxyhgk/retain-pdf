// 栏内横向滚动条：贴在阅读区底部、一直看得见。
//
// 对照模式每栏只有半屏宽，缩放超过 50% 页就比栏宽，每栏各自横向滚（react-pdf.css 的 .reader-react-pdf-pane）。
// 那一栏原生的横向滚动条长在栏的最底下——整本书最后一页下面，平时根本看不到，样式里也藏掉了；
// 用鼠标的人就没法左右挪（触控板左右滑、Shift + 滚轮能滚，但没人知道）。所以在视口底部按每栏的位置画一条
// 自己的滚动条，和那一栏的 scrollLeft 双向同步：拖滑块、点轨道都行。只在那一栏真的放不下时出现。
// 不用原生滚动条做代理：Mac 上原生滚动条平时是隐藏的，要滚了才出来，还是看不见。

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { READER_PANE_ATTR, READER_PDF_PANE_CLASS } from "../../pdf/reader-dom-contract.js";

export type PaneScrollMetrics = {
  pane: string;
  /** 这一栏相对阅读区左边的位置和宽度（滚动条画在它下面）。 */
  left: number;
  width: number;
  scrollWidth: number;
  scrollLeft: number;
};

/** 滑块的宽度和位置（像素，相对轨道左边）；放得下时返回 null。 */
export function paneScrollThumb(
  metrics: Pick<PaneScrollMetrics, "width" | "scrollWidth" | "scrollLeft">,
  trackWidth: number,
  minThumb = 32,
): { size: number; offset: number } | null {
  const { width, scrollWidth, scrollLeft } = metrics;
  const overflow = scrollWidth - width;
  if (!(trackWidth > 0) || !(width > 0) || overflow <= 1) return null;
  const size = Math.min(trackWidth, Math.max(minThumb, (width / scrollWidth) * trackWidth));
  const travel = trackWidth - size;
  const ratio = Math.min(1, Math.max(0, scrollLeft / overflow));
  return { size, offset: travel * ratio };
}

/** 滑块挪了 dx 像素，栏要滚多少。 */
export function paneScrollDelta(
  metrics: Pick<PaneScrollMetrics, "width" | "scrollWidth">,
  trackWidth: number,
  thumbSize: number,
  dx: number,
): number {
  const travel = trackWidth - thumbSize;
  const overflow = metrics.scrollWidth - metrics.width;
  if (travel <= 0 || overflow <= 0) return 0;
  return (dx * overflow) / travel;
}

/** 轨道左右各留的空，和栏边隔开一点。 */
const TRACK_INSET = 12;

function visiblePanes(shell: HTMLElement): HTMLElement[] {
  return Array.from(shell.querySelectorAll<HTMLElement>(`.${READER_PDF_PANE_CLASS}[${READER_PANE_ATTR}]`))
    .filter((pane) => !pane.classList.contains("is-hidden") && pane.clientWidth > 0);
}

function measure(shell: HTMLElement): PaneScrollMetrics[] {
  const shellRect = shell.getBoundingClientRect();
  return visiblePanes(shell).map((pane) => {
    const rect = pane.getBoundingClientRect();
    return {
      pane: pane.getAttribute(READER_PANE_ATTR) || "",
      left: rect.left - shellRect.left,
      width: pane.clientWidth,
      scrollWidth: pane.scrollWidth,
      scrollLeft: pane.scrollLeft,
    };
  });
}

function sameMetrics(a: PaneScrollMetrics[], b: PaneScrollMetrics[]): boolean {
  return a.length === b.length && a.every((item, index) => {
    const other = b[index];
    return item.pane === other.pane
      && Math.abs(item.left - other.left) < 0.5
      && Math.abs(item.width - other.width) < 0.5
      && Math.abs(item.scrollWidth - other.scrollWidth) < 0.5
      && Math.abs(item.scrollLeft - other.scrollLeft) < 0.5;
  });
}

function findPane(shell: HTMLElement | null, pane: string): HTMLElement | null {
  if (!shell) return null;
  return visiblePanes(shell).find((el) => el.getAttribute(READER_PANE_ATTR) === pane) ?? null;
}

export function ReaderPaneScrollbars({ shellEl }: { shellEl: HTMLElement | null }) {
  const [metrics, setMetrics] = useState<PaneScrollMetrics[]>([]);
  const frameRef = useRef(0);

  const schedule = useCallback(() => {
    if (!shellEl || frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const next = measure(shellEl);
      setMetrics((previous) => (sameMetrics(previous, next) ? previous : next));
    });
  }, [shellEl]);

  useEffect(() => {
    if (!shellEl) return undefined;
    schedule();
    const view = shellEl.ownerDocument.defaultView;
    // 栏的横向滚动不冒泡，捕获阶段才收得到；栏宽、页宽（缩放、换模式、开关侧栏）变了靠 ResizeObserver。
    shellEl.addEventListener("scroll", schedule, { capture: true, passive: true });
    const resize = view && typeof view.ResizeObserver !== "undefined" ? new view.ResizeObserver(schedule) : null;
    const observeAll = () => {
      if (!resize) return;
      resize.disconnect();
      resize.observe(shellEl);
      for (const pane of visiblePanes(shellEl)) {
        resize.observe(pane);
        if (pane.firstElementChild) resize.observe(pane.firstElementChild);
      }
    };
    observeAll();
    // 栏挂上、卸下、显示隐藏（换模式）时重新挂观察。
    const mutation = view && typeof view.MutationObserver !== "undefined"
      ? new view.MutationObserver(() => { observeAll(); schedule(); })
      : null;
    const grid = shellEl.firstElementChild;
    if (mutation && grid) mutation.observe(grid, { childList: true, attributes: true, attributeFilter: ["class"], subtree: false });
    return () => {
      shellEl.removeEventListener("scroll", schedule, { capture: true });
      resize?.disconnect();
      mutation?.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [shellEl, schedule]);

  const bars = metrics.filter((item) => item.scrollWidth - item.width > 1);
  if (!bars.length) return null;
  return (
    <div className="reader-pane-scrollbars" data-reader-pane-scrollbars="true">
      {bars.map((item) => (
        <PaneScrollbar key={item.pane} metrics={item} shellEl={shellEl} />
      ))}
    </div>
  );
}

function PaneScrollbar({ metrics, shellEl }: { metrics: PaneScrollMetrics; shellEl: HTMLElement | null }) {
  const trackWidth = Math.max(0, metrics.width - TRACK_INSET * 2);
  const thumb = paneScrollThumb(metrics, trackWidth);
  const dragRef = useRef<{ startX: number; startScroll: number; pointerId: number } | null>(null);
  if (!thumb) return null;

  const scrollPane = (to: number) => {
    const pane = findPane(shellEl, metrics.pane);
    if (pane) pane.scrollLeft = to;
  };

  const onThumbDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { startX: event.clientX, startScroll: metrics.scrollLeft, pointerId: event.pointerId };
  };
  const onThumbMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    scrollPane(drag.startScroll + paneScrollDelta(metrics, trackWidth, thumb.size, event.clientX - drag.startX));
  };
  const onThumbUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  // 点轨道空白处：往那边翻大半栏，和原生滚动条一样。
  const onTrackDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const page = metrics.width * 0.8;
    scrollPane(metrics.scrollLeft + (x < thumb.offset ? -page : page));
  };

  const label = metrics.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动";
  const max = Math.max(0, metrics.scrollWidth - metrics.width);
  return (
    <div
      className="reader-pane-scrollbar"
      data-reader-pane-scrollbar={metrics.pane}
      role="scrollbar"
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(metrics.scrollLeft)}
      style={{ left: metrics.left + TRACK_INSET, width: trackWidth }}
      onPointerDown={onTrackDown}
    >
      <div
        className="reader-pane-scrollbar-thumb"
        style={{ width: thumb.size, transform: `translateX(${thumb.offset}px)` }}
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
      />
    </div>
  );
}
